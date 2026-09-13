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
    let playerLayer = AVPlayerLayer()
    override init(frame: NSRect) { super.init(frame: frame); wantsLayer = true; layer?.backgroundColor = NSColor.black.cgColor; layer?.addSublayer(playerLayer); playerLayer.videoGravity = .resizeAspect }
    required init?(coder: NSCoder) { fatalError("init(coder:) unavailable") }
    override func layout() { super.layout(); CATransaction.begin(); CATransaction.setDisableActions(true); playerLayer.frame = bounds; CATransaction.commit() }
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
            case "screen": _ = CGRequestScreenCaptureAccess()
            case "camera": _ = await AVCaptureDevice.requestAccess(for: .video)
            case "microphone": _ = await AVCaptureDevice.requestAccess(for: .audio)
            case "input": _ = CGRequestListenEventAccess()
            default: throw NativeFailure("Unknown permission kind.", code: "invalid_params")
            }
            return permissions()
        case "recording.start": return try await CaptureEngine.shared.start(projectID: requiredString(params, "projectId"), directory: requiredString(params, "projectDir"), settings: decode(CaptureSettings.self, params["settings"] ?? [:]))
        case "recording.pause": return try CaptureEngine.shared.pause()
        case "recording.resume": return try CaptureEngine.shared.resume()
        case "recording.stop": return try await CaptureEngine.shared.stop()
        case "recording.status": return CaptureEngine.shared.status()
        case "recording.camera": return await CaptureEngine.shared.camera(params)
        case "preview.load":
            let project = try decode(Project.self, params["project"] ?? [:]), directory = try requiredString(params, "projectDir")
            let loadID = UUID(); previewLoadID = loadID
            let sameProject = previewProject?.id == project.id
            let time = sameProject ? (player?.currentTime() ?? .zero) : .zero, playing = sameProject && (player?.rate ?? 0) > 0
            if !sameProject { player?.pause() }
            let built = try await makeComposition(project, directory: directory)
            guard previewLoadID == loadID else { return previewStatus() }
            let item = AVPlayerItem(asset: built.composition); item.videoComposition = built.video; item.audioMix = built.audio
            if player == nil { player = AVPlayer() }
            player?.replaceCurrentItem(with: item); player?.actionAtItemEnd = .pause
            preview?.playerLayer.player = player; previewProject = project
            try await ready(item)
            guard previewLoadID == loadID else { return previewStatus() }
            await seek(CMTimeMinimum(time, mediaTime(timelineDuration(project.edits.segments))))
            if playing { player?.play() }; return previewStatus()
        case "preview.bounds":
            let x = (params["x"] as? NSNumber)?.doubleValue ?? 0, y = (params["y"] as? NSNumber)?.doubleValue ?? 0, width = (params["width"] as? NSNumber)?.doubleValue ?? 0, height = (params["height"] as? NSNumber)?.doubleValue ?? 0
            guard [x, y, width, height].allSatisfy({ $0.isFinite }) else { throw NativeFailure("Invalid preview bounds.") }
            if let content = window?.contentView, let preview { preview.isHidden = width <= 0 || height <= 0; preview.frame = CGRect(x: x, y: content.bounds.height - y - height, width: max(0, width), height: max(0, height)); preview.layoutSubtreeIfNeeded() }
            return ["visible": preview?.isHidden == false]
        case "preview.seek":
            let t = (params["timeMs"] as? NSNumber)?.doubleValue ?? 0; guard t.isFinite, t >= 0 else { throw NativeFailure("Invalid playback time.") }
            guard let item = player?.currentItem else { throw NativeFailure("No preview loaded.", code: "empty_project") }
            try await ready(item)
            await seek(mediaTime(t)); return previewStatus()
        case "preview.play": player?.play(); return previewStatus()
        case "preview.pause": player?.pause(); return previewStatus()
        case "preview.status": return previewStatus()
        case "preview.frame":
            let project = try decode(Project.self, params["project"] ?? [:]), directory = try requiredString(params, "projectDir"), path = try requiredString(params, "path")
            let built = try await makeComposition(project, directory: directory, width: 960, height: 540)
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
        guard let player else { return }
        _ = await withCheckedContinuation { (continuation: CheckedContinuation<Bool, Never>) in
            player.seek(to: time, toleranceBefore: .zero, toleranceAfter: .zero) { completed in continuation.resume(returning: completed) }
        }
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
    func previewStatus() -> [String: Any] { ["timeMs": milliseconds(player?.currentTime() ?? .zero), "playing": (player?.rate ?? 0) > 0] }
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
        let w = params["width"] as? Int ?? 1920, h = params["height"] as? Int ?? 1080
        let destination = URL(fileURLWithPath: path), temporary = destination.deletingLastPathComponent().appendingPathComponent(".screenrec-\(UUID().uuidString).mp4")
        try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
        let job = ExportJob(path: path); jobs[id] = job
        job.task = Task { @MainActor in
            defer { job.session = nil; job.task = nil }
            do {
                let built = try await makeComposition(project, directory: directory, width: w, height: h)
                try Task.checkCancellation()
                guard job.status != "cancelled" else { return }
                guard let session = AVAssetExportSession(asset: built.composition, presetName: w > 1920 ? AVAssetExportPreset3840x2160 : AVAssetExportPreset1920x1080) else { throw NativeFailure("Cannot create export session.") }
                job.session = session; session.videoComposition = built.video; session.audioMix = built.audio; session.shouldOptimizeForNetworkUse = true
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
