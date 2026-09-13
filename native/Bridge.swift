import AppKit
import AVFoundation
import ScreenCaptureKit
import Security

public typealias NativeCallback = @convention(c) (UnsafePointer<CChar>?) -> Void

@_cdecl("screenrec_command")
public func screenrec_command(_ json: UnsafePointer<CChar>?, _ callback: NativeCallback?) {
    guard let callback else { return }
    let data = json.map { Data(String(cString: $0).utf8) } ?? Data()
    Task { @MainActor in
        var id: Any?
        do {
            guard let request = try JSONSerialization.jsonObject(with: data) as? [String: Any], let method = request["method"] as? String else { throw NativeFailure("Malformed native request.", code: "invalid_request") }
            id = request["id"]
            let result = try await NativeApp.shared.command(method, request["params"] as? [String: Any] ?? [:])
            var response: [String: Any] = ["result": result]; if let id { response["id"] = id }
            let output = try JSONSerialization.data(withJSONObject: response, options: [.sortedKeys])
            String(decoding: output, as: UTF8.self).withCString { callback($0) }
        } catch {
            var response: [String: Any] = ["error": ["code": (error as? NativeFailure)?.code ?? "native_error", "message": error.localizedDescription]]; if let id { response["id"] = id }
            let output = (try? JSONSerialization.data(withJSONObject: response)) ?? Data("{\"error\":{\"code\":\"native_error\",\"message\":\"Response encoding failed\"}}".utf8)
            String(decoding: output, as: UTF8.self).withCString { callback($0) }
        }
    }
}
@_cdecl("screenrec_attach_window")
public func screenrec_attach_window(_ pointer: UnsafeMutableRawPointer?) {
    guard let pointer else { return }
    DispatchQueue.main.async {
        let window = Unmanaged<NSWindow>.fromOpaque(pointer).takeUnretainedValue()
        NativeApp.shared.attach(window)
    }
}

final class PreviewView: NSView {
    let playerLayer = AVPlayerLayer(), selectionLayer = CAShapeLayer(), handlesLayer = CAShapeLayer()
    var canvasSize = CGSize(width: 1920, height: 1080), selectedRect: CGRect?
    override init(frame: NSRect) {
        super.init(frame: frame); wantsLayer = true; layer?.backgroundColor = NSColor.black.cgColor
        layer?.addSublayer(playerLayer); playerLayer.videoGravity = .resizeAspect
        selectionLayer.fillColor = nil; selectionLayer.strokeColor = NSColor.controlAccentColor.cgColor; selectionLayer.lineWidth = 1.5
        handlesLayer.fillColor = NSColor.controlAccentColor.cgColor; handlesLayer.strokeColor = NSColor.black.cgColor; handlesLayer.lineWidth = 1
        layer?.addSublayer(selectionLayer); layer?.addSublayer(handlesLayer)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) unavailable") }
    override func layout() {
        super.layout(); CATransaction.begin(); CATransaction.setDisableActions(true)
        playerLayer.frame = bounds; selectionLayer.frame = bounds; handlesLayer.frame = bounds
        selectionLayer.contentsScale = window?.backingScaleFactor ?? 2; handlesLayer.contentsScale = selectionLayer.contentsScale
        if let selectedRect, canvasSize.width > 0, canvasSize.height > 0 {
            let scale = min(bounds.width / canvasSize.width, bounds.height / canvasSize.height)
            let size = CGSize(width: canvasSize.width * scale, height: canvasSize.height * scale)
            let rect = CGRect(x: (bounds.width - size.width) / 2 + selectedRect.minX * size.width, y: (bounds.height - size.height) / 2 + (1 - selectedRect.maxY) * size.height, width: selectedRect.width * size.width, height: selectedRect.height * size.height)
            selectionLayer.path = CGPath(rect: rect, transform: nil)
            let handles = CGMutablePath()
            for x in [rect.minX, rect.maxX] { for y in [rect.minY, rect.maxY] { handles.addRect(CGRect(x: x - 4, y: y - 4, width: 8, height: 8)) } }
            handlesLayer.path = handles
        } else { selectionLayer.path = nil; handlesLayer.path = nil }
        CATransaction.commit()
    }
    func select(_ rect: CGRect?, canvas: CGSize) { selectedRect = rect; canvasSize = canvas; needsLayout = true; layoutSubtreeIfNeeded() }
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
}
final class ExportJob {
    var status = "running"; var path: String; var error: String?; var session: AVAssetExportSession?; var task: Task<Void, Never>?
    init(path: String) { self.path = path }
    var result: [String: Any] { var r: [String: Any] = ["status": status, "progress": status == "completed" ? 1 : Double(session?.progress ?? 0), "path": path]; if let error { r["error"] = error }; return r }
}

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
    func seek(_ time: CMTime) async {
        guard let item = player?.currentItem else { return }
        let end = max(0, timelineDuration(previewProject?.edits.segments ?? []) - 1000 / 30)
        pendingSeek = (mediaTime(max(0, min(end, milliseconds(time)))), item)
        await withCheckedContinuation { continuation in
            seekWaiters.append(continuation)
            guard !seeking else { return }
            seeking = true
            Task { @MainActor in
                // A seek in flight is allowed to finish; intermediate pending targets are discarded.
                while let target = pendingSeek {
                    pendingSeek = nil
                    guard player?.currentItem === target.item else { continue }
                    _ = await withCheckedContinuation { (done: CheckedContinuation<Bool, Never>) in
                        target.item.seek(to: target.time, toleranceBefore: .zero, toleranceAfter: .zero) { done.resume(returning: $0) }
                    }
                    updateSelection()
                }
                seeking = false
                let completed = seekWaiters; seekWaiters.removeAll(keepingCapacity: true)
                for waiter in completed { waiter.resume() }
            }
        }
    }
    func previewGeometry(at time: Double) -> [String: Any] {
        guard let built = previewBuilt else { return ["width": 0, "height": 0, "items": []] }
        let instruction = built.instruction, project = instruction.project, size = built.video.renderSize
        let bounds = CGRect(origin: .zero, size: size), sourceMs = sourceTime(project.edits.segments, time)
        var items: [[String: Any]] = []
        func add(_ kind: String, _ id: String, _ rect: CGRect) {
            items.append(["kind": kind, "id": id, "x": Double(rect.minX / size.width), "y": Double(1 - rect.maxY / size.height), "width": Double(rect.width / size.width), "height": Double(rect.height / size.height)])
        }
        if cameraVisible(project, at: sourceMs) {
            add("camera", "camera", cameraRect(cameraVisual(instruction.cameraRuns, at: time, fallback: CameraVisual(project.edits.camera)), bounds: bounds))
        }
        for overlay in project.edits.overlays where sourceMs >= overlay.startMs && sourceMs < overlay.endMs {
            add("overlay", overlay.id, overlayRect(overlay, sourceMs: sourceMs, bounds: bounds, images: instruction.images))
        }
        return ["width": Double(size.width), "height": Double(size.height), "items": items]
    }
    func updateSelection() {
        guard let preview else { return }
        let geometry = previewGeometry(at: milliseconds(player?.currentTime() ?? .zero))
        let items = geometry["items"] as? [[String: Any]] ?? []
        let selected = items.first { $0["kind"] as? String == selectedItem?.kind && $0["id"] as? String == selectedItem?.id }
        let rect = selected.map { CGRect(x: $0["x"] as! Double, y: $0["y"] as! Double, width: $0["width"] as! Double, height: $0["height"] as! Double) }
        preview.select(rect, canvas: previewBuilt?.video.renderSize ?? .zero)
    }
    func ready(_ item: AVPlayerItem) async throws {
        for _ in 0..<500 {
            if item.status == .readyToPlay { return }
            if item.status == .failed { throw item.error ?? NativeFailure("Preview media could not be loaded.") }
            if player?.currentItem !== item { throw NativeFailure("Preview was replaced by another edit.", code: "preview_replaced") }
            try await Task.sleep(nanoseconds: 20_000_000)
        }
        throw NativeFailure("Timed out loading preview media.", code: "preview_timeout")
    }
    func previewStatus() -> [String: Any] { let time = milliseconds(player?.currentTime() ?? .zero); return ["timeMs": time, "playing": (player?.rate ?? 0) > 0, "seeking": seeking, "itemId": previewItemID.uuidString, "geometry": previewGeometry(at: time)] }
    func requestDesktopPermission(_ kind: String, check: (() -> Bool)? = nil, request: (() -> Bool)? = nil, openSettings: (URL) -> Bool = { NSWorkspace.shared.open($0) }) throws {
        guard kind == "screen" || kind == "input" else { throw NativeFailure("Unknown desktop permission kind.", code: "invalid_params") }
        let screen = kind == "screen"
        let isGranted = check ?? (screen ? CGPreflightScreenCaptureAccess : CGPreflightListenEventAccess)
        let requestAccess = request ?? (screen ? CGRequestScreenCaptureAccess : CGRequestListenEventAccess)
        guard !isGranted() else { return }
        _ = requestAccess()
        guard !isGranted() else { return }
        let pane = screen ? "Privacy_ScreenCapture" : "Privacy_ListenEvent", name = screen ? "Screen & System Audio Recording" : "Input Monitoring"
        let settings = URL(string: "x-apple.systempreferences:com.apple.preference.security?\(pane)")!
        guard openSettings(settings) else { throw NativeFailure("Could not open \(name) settings. Open System Settings → Privacy & Security → \(name) and enable Screen Recorder.", code: "settings_unavailable") }
    }
    func permissions() -> [String: Any] {
        func name(_ status: AVAuthorizationStatus) -> String { switch status { case .authorized: return "authorized"; case .denied: return "denied"; case .restricted: return "restricted"; default: return "notDetermined" } }
        return ["screen": CGPreflightScreenCaptureAccess(), "camera": name(AVCaptureDevice.authorizationStatus(for: .video)), "microphone": name(AVCaptureDevice.authorizationStatus(for: .audio)), "input": CGPreflightListenEventAccess()]
    }
    func capabilities() async -> [String: Any] {
        var sources: [[String: Any]] = []
        if CGPreflightScreenCaptureAccess(), let content = try? await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true) {
            sources = content.displays.map { ["id": "display:\($0.displayID)", "name": "Display \($0.displayID)", "kind": "display", "width": $0.width, "height": $0.height] }
            sources += content.windows.filter { $0.windowLayer == 0 && $0.owningApplication?.processID != getpid() && $0.frame.width >= 100 && $0.frame.height >= 100 && !($0.title ?? "").isEmpty }.map { ["id": "window:\($0.windowID)", "name": "\($0.owningApplication?.applicationName ?? "Window") — \($0.title ?? "")", "kind": "window", "width": Int($0.frame.width), "height": Int($0.frame.height)] }
        }
        let cameras = AVCaptureDevice.DiscoverySession(deviceTypes: [.builtInWideAngleCamera, .external, .continuityCamera], mediaType: .video, position: .unspecified).devices.map { ["id": $0.uniqueID, "name": $0.localizedName] }
        let microphones = AVCaptureDevice.DiscoverySession(deviceTypes: [.microphone, .external], mediaType: .audio, position: .unspecified).devices.map { ["id": $0.uniqueID, "name": $0.localizedName] }
        return ["nativeAvailable": true, "platform": "macos", "permissions": permissions(), "sources": sources, "cameras": cameras, "microphones": microphones, "recording": CaptureEngine.shared.status()]
    }
    func startExport(_ params: [String: Any]) async throws -> [String: Any] {
        let project = try decode(Project.self, params["project"] ?? [:]), directory = try requiredString(params, "projectDir"), path = try requiredString(params, "path"), id = try requiredString(params, "jobId")
        guard jobs[id] == nil else { throw NativeFailure("Export job ID already exists.", code: "conflict") }
        guard !FileManager.default.fileExists(atPath: path) else { throw NativeFailure("Export destination already exists.", code: "file_exists") }
        let presets: [String: CGSize] = ["1:1": CGSize(width: 1080, height: 1080), "4:5": CGSize(width: 1080, height: 1350)]
        let size = presets[project.edits.canvas?.aspectRatio ?? "source"] ?? renderDimensions(project, longEdge: 1920)
        let w = params["width"] as? Int ?? Int(size.width), h = params["height"] as? Int ?? Int(size.height)
        let destination = URL(fileURLWithPath: path), temporary = destination.deletingLastPathComponent().appendingPathComponent(".screenrec-\(UUID().uuidString).mp4")
        try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
        let job = ExportJob(path: path); jobs[id] = job
        job.task = Task { @MainActor in
            defer { job.session = nil; job.task = nil }
            do {
                let built = try await makeComposition(project, directory: directory, width: w, height: h)
                try Task.checkCancellation()
                guard job.status != "cancelled" else { return }
                guard let session = AVAssetExportSession(asset: built.composition, presetName: AVAssetExportPresetHighestQuality) else { throw NativeFailure("Cannot create export session.") }
                job.session = session; session.videoComposition = built.video; session.audioMix = built.audio; session.audioTimePitchAlgorithm = .spectral; session.shouldOptimizeForNetworkUse = true
                try await session.export(to: temporary, as: .mp4)
                guard job.status != "cancelled" else { try? FileManager.default.removeItem(at: temporary); return }
                try FileManager.default.moveItem(at: temporary, to: destination); job.status = "completed"
            } catch { try? FileManager.default.removeItem(at: temporary); if job.status != "cancelled" { job.status = "failed"; job.error = error.localizedDescription } }
        }
        return ["started": true, "jobId": id]
    }
    func inspectMedia(_ path: String) async throws -> [String: Any] {
        let asset = AVURLAsset(url: URL(fileURLWithPath: path))
        guard let video = try await asset.loadTracks(withMediaType: .video).first else { throw NativeFailure("Selected file has no video track.", code: "invalid_media") }
        let (duration, size, transform, fps, audio) = try await (asset.load(.duration), video.load(.naturalSize), video.load(.preferredTransform), video.load(.nominalFrameRate), asset.loadTracks(withMediaType: .audio))
        let rotated = size.applying(transform)
        return ["durationMs": milliseconds(duration), "width": Int(abs(rotated.width)), "height": Int(abs(rotated.height)), "fps": fps, "hasAudio": !audio.isEmpty]
    }
    func keychain(_ method: String, _ params: [String: Any]) throws -> [String: Any] {
        let provider = try requiredString(params, "provider")
        guard provider.count < 100 else { throw NativeFailure("Invalid provider.") }
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "dev.screenrec.provider-key", kSecAttrAccount as String: provider]
        if method == "keychain.get" {
            var q = query; q[kSecReturnData as String] = true; q[kSecMatchLimit as String] = kSecMatchLimitOne
            var result: CFTypeRef?; let status = SecItemCopyMatching(q as CFDictionary, &result)
            if status == errSecItemNotFound { return ["key": NSNull()] }
            guard status == errSecSuccess, let data = result as? Data else { throw NativeFailure("Keychain read failed (\(status)).") }; return ["key": String(decoding: data, as: UTF8.self)]
        }
        if method == "keychain.delete" { let status = SecItemDelete(query as CFDictionary); guard status == errSecSuccess || status == errSecItemNotFound else { throw NativeFailure("Keychain delete failed (\(status)).") }; return ["deleted": true] }
        let key = try requiredString(params, "key"); guard key.count <= 16000 else { throw NativeFailure("API key is too long.") }
        let data = Data(key.utf8); var status = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if status == errSecItemNotFound { var q = query; q[kSecValueData as String] = data; q[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly; status = SecItemAdd(q as CFDictionary, nil) }
        guard status == errSecSuccess else { throw NativeFailure("Keychain save failed (\(status)).") }; return ["saved": true]
    }
}
