import AppKit
import AVFoundation
import ScreenCaptureKit
import Security

@MainActor final class NativeApp {
    static let shared = NativeApp()
    weak var window: NSWindow?; var preview: PreviewView?; var player: AVPlayer?; var previewProject: Project?; var previewLoadID = UUID()
    var previewBuilt: BuiltComposition?, previewStructure: Data?, previewItemID = UUID()
    var previewRevision = -1, previewSequence = -1
    var previewTargetProjectID: String?
    let previewMetrics = PreviewRenderMetrics()
    var selectedItem: (kind: String, id: String)?
    var playbackObserver: Any?
    var pendingSeek: (time: CMTime, item: AVPlayerItem)?, seeking = false
    var seekWaiters: [CheckedContinuation<Void, Never>] = []
    var jobs: [String: ExportJob] = [:]
    func attach(_ window: NSWindow) {
        if self.window !== window { preview?.removeFromSuperview(); preview = nil }
        self.window = window
        if preview == nil { let view = PreviewView(frame: .zero); view.isHidden = true; window.contentView?.addSubview(view, positioned: .above, relativeTo: nil); preview = view; view.playerLayer.player = player }
    }
    func command(_ method: String, _ params: [String: Any]) async throws -> Any {
        switch method {
        case "capabilities": return await capabilities()
        case "permissions.request":
            let kind = try requiredString(params, "kind")
            switch kind {
            case "screen", "input": try requestDesktopPermission(kind)
            case "camera": _ = await AVCaptureDevice.requestAccess(for: .video)
            case "microphone": _ = await AVCaptureDevice.requestAccess(for: .audio)
            default: throw NativeFailure("Unknown permission kind.", code: "invalid_params")
            }
            return permissions()
        case "recording.start": return try await CaptureEngine.shared.start(projectID: requiredString(params, "projectId"), directory: requiredString(params, "projectDir"), settings: decode(CaptureSettings.self, params["settings"] ?? [:]))
        case "recording.pause": return try await CaptureEngine.shared.pause()
        case "recording.resume": return try await CaptureEngine.shared.resume()
        case "recording.stop": return try await CaptureEngine.shared.stop()
        case "recording.status": return CaptureEngine.shared.status()
        case "recording.camera": return await CaptureEngine.shared.camera(params)
        case "preview.load", "preview.update":
            let startedAt = ProcessInfo.processInfo.systemUptime
            let object = params["project"] as? [String: Any] ?? [:]
            let project = try decode(Project.self, object), directory = try requiredString(params, "projectDir")
            let revision = (params["revision"] as? Int) ?? (params["expectedRevision"] as? Int) ?? (object["revision"] as? Int) ?? 0
            let sequence = params["sequence"] as? Int ?? 0
            if method == "preview.update" {
                guard previewProject?.id == project.id && previewTargetProjectID == project.id else { throw NativeFailure("Preview belongs to another project.", code: "preview_replaced") }
                guard revision >= previewRevision else { return previewStatus() }
                if revision == previewRevision, sequence < previewSequence { return previewStatus() }
            }
            let loadID = UUID(); previewLoadID = loadID; previewTargetProjectID = project.id
            previewRevision = revision; previewSequence = sequence
            let structure = try mediaStructure(project, directory: directory)
            let sameProject = previewProject?.id == project.id
            if sameProject && structure == previewStructure, let previous = previewBuilt, let item = player?.currentItem {
                let built = try await updateComposition(project, previous: previous)
                guard previewLoadID == loadID, player?.currentItem === item else { return previewStatus() }
                built.instruction.previewMetrics = previewMetrics
                previewMetrics.begin(id: built.instruction.renderID, kind: "update", started: startedAt, inputAtMs: (params["inputAtMs"] as? NSNumber)?.doubleValue)
                // Replacing the video composition also redraws a paused frame (Apple QA1966).
                item.videoComposition = built.video; item.audioMix = built.audio
                previewBuilt = built; previewProject = project; previewRevision = revision; previewSequence = sequence
                updateSelection(); return previewStatus()
            }
            let time = sameProject ? (player?.currentTime() ?? .zero) : .zero, playing = sameProject && (player?.rate ?? 0) > 0
            if !sameProject { player?.pause(); selectedItem = nil }
            let built = try await makeComposition(project, directory: directory)
            guard previewLoadID == loadID else { return previewStatus() }
            built.instruction.previewMetrics = previewMetrics
            previewMetrics.begin(id: built.instruction.renderID, kind: "load", started: startedAt, inputAtMs: (params["inputAtMs"] as? NSNumber)?.doubleValue)
            let item = AVPlayerItem(asset: built.composition); item.videoComposition = built.video; item.audioMix = built.audio; item.audioTimePitchAlgorithm = .spectral
            if player == nil {
                player = AVPlayer()
                playbackObserver = player?.addPeriodicTimeObserver(forInterval: CMTime(value: 1, timescale: 30), queue: .main) { [weak self] _ in
                    MainActor.assumeIsolated { if self?.selectedItem != nil { self?.updateSelection() } }
                }
            }
            pendingSeek = nil
            player?.replaceCurrentItem(with: item); player?.actionAtItemEnd = .pause
            preview?.playerLayer.player = player; previewProject = project; previewBuilt = built; previewStructure = structure; previewItemID = UUID()
            previewRevision = revision; previewSequence = sequence
            try await ready(item)
            guard previewLoadID == loadID else { return previewStatus() }
            await seek(CMTimeMinimum(time, mediaTime(timelineDuration(project.edits.segments))))
            guard previewLoadID == loadID else { return previewStatus() }
            if playing { player?.play() }; updateSelection(); return previewStatus()
        case "preview.metrics": return previewMetrics.snapshot(reset: params["reset"] as? Bool ?? false)
        case "preview.geometry":
            let time = (params["timeMs"] as? NSNumber)?.doubleValue ?? milliseconds(player?.currentTime() ?? .zero)
            guard time.isFinite, time >= 0 else { throw NativeFailure("Invalid geometry time.", code: "invalid_params") }
            return previewGeometry(at: time)
        case "preview.selection":
            if let hex = params["color"] as? String {
                guard hex.range(of: "^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$", options: .regularExpression) != nil else { throw NativeFailure("Invalid selection color.", code: "invalid_params") }
                preview?.selectionLayer.strokeColor = color(hex).cgColor; preview?.handlesLayer.fillColor = color(hex).cgColor
            }
            if let selection = params["selection"] as? [String: Any] {
                guard let kind = selection["kind"] as? String, kind == "camera" || kind == "overlay" else { throw NativeFailure("Invalid preview selection.", code: "invalid_params") }
                let id = selection["id"] as? String ?? (kind == "camera" ? "camera" : "")
                guard kind == "camera" || previewProject?.edits.overlays.contains(where: { $0.id == id }) == true else { throw NativeFailure("Selected overlay is unavailable.", code: "not_found") }
                selectedItem = (kind, id)
            } else { selectedItem = nil }
            updateSelection(); return previewGeometry(at: milliseconds(player?.currentTime() ?? .zero))
        case "preview.bounds":
            let x = (params["x"] as? NSNumber)?.doubleValue ?? 0, y = (params["y"] as? NSNumber)?.doubleValue ?? 0, width = (params["width"] as? NSNumber)?.doubleValue ?? 0, height = (params["height"] as? NSNumber)?.doubleValue ?? 0
            guard [x, y, width, height].allSatisfy({ $0.isFinite }) else { throw NativeFailure("Invalid preview bounds.") }
            if let content = window?.contentView, let preview { preview.isHidden = width <= 0 || height <= 0; preview.frame = CGRect(x: x, y: content.bounds.height - y - height, width: max(0, width), height: max(0, height)); preview.layoutSubtreeIfNeeded() }
            return ["visible": preview?.isHidden == false]
        case "preview.seek":
            let startedAt = ProcessInfo.processInfo.systemUptime
            let t = (params["timeMs"] as? NSNumber)?.doubleValue ?? 0; guard t.isFinite, t >= 0 else { throw NativeFailure("Invalid playback time.") }
            guard let item = player?.currentItem else { throw NativeFailure("No preview loaded.", code: "empty_project") }
            try await ready(item)
            if let instruction = previewBuilt?.instruction { previewMetrics.begin(id: instruction.renderID, kind: "seek", started: startedAt, targetMs: min(t, max(0, timelineDuration(instruction.project.edits.segments) - 1000 / 30)), inputAtMs: (params["inputAtMs"] as? NSNumber)?.doubleValue) }
            await seek(mediaTime(t)); return previewStatus()
        case "preview.play": player?.play(); return previewStatus()
        case "preview.pause": player?.pause(); return previewStatus()
        case "preview.status": return previewStatus()
        case "preview.frame":
            let project = try decode(Project.self, params["project"] ?? [:]), directory = try requiredString(params, "projectDir"), path = try requiredString(params, "path")
            let size = renderDimensions(project, longEdge: 960)
            let built = try await makeComposition(project, directory: directory, width: Int(size.width), height: Int(size.height))
            let generator = AVAssetImageGenerator(asset: built.composition); generator.videoComposition = built.video
            generator.requestedTimeToleranceBefore = .zero; generator.requestedTimeToleranceAfter = .zero
            let frame = try await generator.image(at: mediaTime((params["timeMs"] as? NSNumber)?.doubleValue ?? 0)).image
            let bitmap = NSBitmapImageRep(cgImage: frame)
            guard let data = bitmap.representation(using: .png, properties: [:]) else { throw NativeFailure("Could not encode thumbnail.") }
            try data.write(to: URL(fileURLWithPath: path), options: .atomic); return ["path": path]
        case "export.start": return try await startExport(params)
        case "export.status": guard let job = jobs[try requiredString(params, "jobId")] else { throw NativeFailure("Export job not found.", code: "not_found") }; return job.result
        case "export.cancel":
            guard let job = jobs[try requiredString(params, "jobId")] else { throw NativeFailure("Export job not found.", code: "not_found") }
            if job.status == "running" { job.status = "cancelled"; job.session?.cancelExport(); job.task?.cancel() }; return job.result
        case "audio.analyze":
            let project = try decode(Project.self, params["project"] ?? [:]), directory = try requiredString(params, "projectDir")
            guard let source = project.source else { throw NativeFailure("No source media.") }
            var result: [String: Any] = ["microphone": [], "system": []]
            if let path = source.microphone { result["microphone"] = try await analyzeAudio(projectURL(directory, path)) }
            if let path = source.systemAudio { result["system"] = try await analyzeAudio(projectURL(directory, path)) }; return result
        case "audio.prepare": return try await prepareAudio(decode(RecordingSource.self, params["source"] ?? [:]), directory: requiredString(params, "projectDir"), destination: requiredString(params, "path"))
        case "media.inspect": return try await inspectMedia(requiredString(params, "path"))
        case "project.trash":
            let url = URL(fileURLWithPath: try requiredString(params, "path")); guard url.path != "/", url.path != NSHomeDirectory() else { throw NativeFailure("Invalid trash target.", code: "invalid_path") }
            try FileManager.default.trashItem(at: url, resultingItemURL: nil); return ["trashed": true]
        case "keychain.get", "keychain.set", "keychain.delete": return try keychain(method, params)
        default: throw NativeFailure("Unsupported native method: \(method)", code: "method_not_found")
        }
    }
}
