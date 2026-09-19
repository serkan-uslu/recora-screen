import AppKit
import AVFoundation
import ScreenCaptureKit
import Security
import ImageIO
import UniformTypeIdentifiers

@MainActor extension NativeApp {
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
            add("camera", "camera", cameraRect(renderedCamera(instruction, outputMs: time, sourceMs: sourceMs), bounds: bounds))
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
        let isGranted = check ?? (screen ? CGPreflightScreenCaptureAccess : inputMonitoringAvailable)
        let requestAccess = request ?? (screen ? CGRequestScreenCaptureAccess : CGRequestListenEventAccess)
        guard !isGranted() else { return }
        _ = requestAccess()
        guard !isGranted() else { return }
        let pane = screen ? "Privacy_ScreenCapture" : "Privacy_ListenEvent", name = screen ? "Screen & System Audio Recording" : "Input Monitoring"
        let settings = URL(string: "x-apple.systempreferences:com.apple.preference.security?\(pane)")!
        guard openSettings(settings) else { throw NativeFailure("Could not open \(name) settings. Open System Settings → Privacy & Security → \(name) and enable Recora Screen.", code: "settings_unavailable") }
    }
    func permissions() -> [String: Any] {
        func name(_ status: AVAuthorizationStatus) -> String { switch status { case .authorized: return "authorized"; case .denied: return "denied"; case .restricted: return "restricted"; default: return "notDetermined" } }
        return ["screen": CGPreflightScreenCaptureAccess(), "camera": name(AVCaptureDevice.authorizationStatus(for: .video)), "microphone": name(AVCaptureDevice.authorizationStatus(for: .audio)), "input": inputMonitoringAvailable()]
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
        let format = params["format"] as? String ?? "mp4", fps = params["gifFps"] as? Int ?? 15
        guard ["mp4", "gif"].contains(format), URL(fileURLWithPath: path).pathExtension.lowercased() == format else { throw NativeFailure("Export format and filename must match.", code: "invalid_params") }
        if format == "gif" {
            guard [15,20,25,30].contains(fps), w <= 1280, h <= 1280, timelineDuration(project.edits.segments) <= 60000 else { throw NativeFailure("GIF supports 15–30 FPS, up to 60 seconds and 1280 pixels per axis.", code: "invalid_params") }
        }
        let destination = URL(fileURLWithPath: path), temporary = destination.deletingLastPathComponent().appendingPathComponent(".screenrec-\(UUID().uuidString).\(format)")
        try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
        let job = ExportJob(path: path); jobs[id] = job
        job.task = Task { @MainActor in
            defer { job.session = nil; job.task = nil }
            do {
                let built = try await makeComposition(project, directory: directory, width: w, height: h)
                try Task.checkCancellation()
                guard job.status != "cancelled" else { return }
                if format == "gif" {
                    try await self.exportGIF(built, to: temporary, fps: fps, loop: params["loop"] as? Bool ?? true, job: job)
                    try Task.checkCancellation()
                    guard job.status != "cancelled" else { try? FileManager.default.removeItem(at: temporary); return }
                    try FileManager.default.moveItem(at: temporary, to: destination); job.status = "completed"; return
                }
                guard let session = AVAssetExportSession(asset: built.composition, presetName: AVAssetExportPresetHighestQuality) else { throw NativeFailure("Cannot create export session.") }
                job.session = session; session.videoComposition = built.video; session.audioMix = built.audio; session.audioTimePitchAlgorithm = .spectral; session.shouldOptimizeForNetworkUse = true
                try await session.export(to: temporary, as: .mp4)
                guard job.status != "cancelled" else { try? FileManager.default.removeItem(at: temporary); return }
                try FileManager.default.moveItem(at: temporary, to: destination); job.status = "completed"
            } catch { try? FileManager.default.removeItem(at: temporary); if job.status != "cancelled" { job.status = "failed"; job.error = error.localizedDescription } }
        }
        return ["started": true, "jobId": id]
    }
    func exportGIF(_ built: BuiltComposition, to url: URL, fps: Int, loop: Bool, job: ExportJob) async throws {
        let seconds = built.instruction.timeRange.duration.seconds
        let count = max(1, Int(ceil(seconds * Double(fps))))
        guard let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.gif.identifier as CFString, count, nil) else { throw NativeFailure("Could not create GIF output.") }
        if loop { CGImageDestinationSetProperties(destination, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0]] as CFDictionary) }
        let generator = AVAssetImageGenerator(asset: built.composition)
        built.video.frameDuration = CMTime(value: 1, timescale: CMTimeScale(fps))
        generator.videoComposition = built.video; generator.requestedTimeToleranceBefore = .zero; generator.requestedTimeToleranceAfter = .zero
        defer { generator.cancelAllCGImageGeneration() }
        // ImageIO writes to a file destination; one decoded frame is held at a time.
        for index in 0..<count {
            try Task.checkCancellation()
            let time = Double(index) / Double(fps)
            let image = try await generator.image(at: CMTime(seconds: time, preferredTimescale: 600000)).image
            let delay = max(0.02, (min(seconds, Double(index + 1) / Double(fps)) * 100).rounded() / 100 - (time * 100).rounded() / 100)
            CGImageDestinationAddImage(destination, image, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFDelayTime: delay, kCGImagePropertyGIFUnclampedDelayTime: delay]] as CFDictionary)
            job.gifProgress = Double(index + 1) / Double(count) * 0.95
        }
        try Task.checkCancellation()
        guard CGImageDestinationFinalize(destination) else { throw NativeFailure("GIF encoding failed.") }
    }
    func timelineFrames(_ path: String, image: Bool, startMs: Double, endMs: Double) async throws -> [[String: Any]] {
        func encoded(_ image: CGImage, at time: Double) throws -> [String: Any] {
            guard let data = NSBitmapImageRep(cgImage: image).representation(using: .jpeg, properties: [.compressionFactor: 0.6]) else { throw NativeFailure("Could not encode timeline frame.") }
            return ["timeMs": time, "src": "data:image/jpeg;base64," + data.base64EncodedString()]
        }
        if image {
            guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil), let frame = CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true, kCGImageSourceThumbnailMaxPixelSize: 192] as CFDictionary) else { throw NativeFailure("Could not decode timeline image.") }
            return try (0..<8).map { _ in try encoded(frame, at: startMs) }
        }
        let asset = AVURLAsset(url: URL(fileURLWithPath: path)), generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true; generator.maximumSize = CGSize(width: 192, height: 108)
        generator.requestedTimeToleranceBefore = mediaTime(1000 / 30); generator.requestedTimeToleranceAfter = mediaTime(1000 / 30)
        var frames: [[String: Any]] = []
        for index in 0..<8 {
            try Task.checkCancellation()
            let frame = try await generator.image(at: mediaTime(startMs + (endMs - startMs) * (Double(index) + 0.5) / 8))
            frames.append(try encoded(frame.image, at: max(0, milliseconds(frame.actualTime))))
        }
        return frames
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
