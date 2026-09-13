import AppKit
@preconcurrency import AVFoundation
import ScreenCaptureKit

func cursorPosition(_ point: CGPoint, captureRect: CGRect, normalizedContentRect: CGRect) -> CGPoint? {
    guard captureRect.width > 0, captureRect.height > 0 else { return nil }
    let x = (point.x - captureRect.minX) / captureRect.width, y = (point.y - captureRect.minY) / captureRect.height
    guard x >= 0, x <= 1, y >= 0, y <= 1 else { return nil }
    let result = CGPoint(x: normalizedContentRect.minX + x * normalizedContentRect.width, y: normalizedContentRect.minY + y * normalizedContentRect.height)
    return result.x >= 0 && result.x <= 1 && result.y >= 0 && result.y <= 1 ? result : nil
}
import CoreMedia

final class TrackWriter {
    let writer: AVAssetWriter; let input: AVAssetWriterInput; let video: Bool
    var lastVideo: CMSampleBuffer?; var samples = 0
    init(url: URL, videoSize: CGSize? = nil) throws {
        video = videoSize != nil
        writer = try AVAssetWriter(outputURL: url, fileType: .mov)
        writer.initialMovieFragmentInterval = CMTime(seconds: 1, preferredTimescale: 600)
        writer.movieFragmentInterval = CMTime(seconds: 10, preferredTimescale: 600)
        if let size = videoSize {
            input = AVAssetWriterInput(mediaType: .video, outputSettings: [AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: Int(size.width), AVVideoHeightKey: Int(size.height), AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: Int(size.width * size.height * 4), AVVideoExpectedSourceFrameRateKey: 30, AVVideoMaxKeyFrameIntervalKey: 60]])
        } else {
            input = AVAssetWriterInput(mediaType: .audio, outputSettings: [AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: 48000, AVNumberOfChannelsKey: 2, AVEncoderBitRateKey: 192000])
        }
        input.expectsMediaDataInRealTime = true
        guard writer.canAdd(input) else { throw NativeFailure("Encoder cannot create requested track.") }
        writer.add(input)
        guard writer.startWriting() else { throw writer.error ?? NativeFailure("Encoder failed to start.") }
        writer.startSession(atSourceTime: .zero)
    }
    func append(_ sample: CMSampleBuffer) throws {
        if writer.status == .failed { throw writer.error ?? NativeFailure("Recording writer failed.") }
        guard input.isReadyForMoreMediaData else { if !video { throw NativeFailure("Audio encoder cannot keep up; recording stopped to preserve synchronization.") }; return }
        guard input.append(sample) else { throw writer.error ?? NativeFailure("Could not append media sample.") }
        samples += 1; if video { lastVideo = sample }
    }
    func finish(at time: CMTime) async throws {
        if video, let last = lastVideo, time > last.presentationTimeStamp, input.isReadyForMoreMediaData {
            var timing = CMSampleTimingInfo(duration: CMTime(value: 1, timescale: 30), presentationTimeStamp: time, decodeTimeStamp: .invalid)
            var copy: CMSampleBuffer?
            if CMSampleBufferCreateCopyWithNewTiming(allocator: kCFAllocatorDefault, sampleBuffer: last, sampleTimingEntryCount: 1, sampleTimingArray: &timing, sampleBufferOut: &copy) == noErr, let copy { _ = input.append(copy) }
        }
        writer.endSession(atSourceTime: time); input.markAsFinished()
        await writer.finishWriting()
        if writer.status == .failed { throw writer.error ?? NativeFailure("Recording file could not be finalized.") }
    }
}

final class CameraBubbleView: NSView {
    let preview = AVCaptureVideoPreviewLayer(); var shape = "circle" { didSet { updateMask() } }
    private var initialMouse: CGPoint = .zero; private var initialFrame = CGRect.zero; private var resizing = false
    override init(frame: NSRect) { super.init(frame: frame); wantsLayer = true; layer?.addSublayer(preview); preview.videoGravity = .resizeAspectFill }
    required init?(coder: NSCoder) { fatalError("init(coder:) unavailable") }
    override func layout() { super.layout(); preview.frame = bounds; updateMask() }
    private func updateMask() { let mask = CAShapeLayer(); mask.path = shape == "circle" ? CGPath(ellipseIn: bounds, transform: nil) : CGPath(roundedRect: bounds, cornerWidth: 18, cornerHeight: 18, transform: nil); layer?.mask = mask }
    override func mouseDown(with event: NSEvent) { initialMouse = NSEvent.mouseLocation; initialFrame = window?.frame ?? .zero; let point = convert(event.locationInWindow, from: nil); resizing = point.x > bounds.width - 32 && point.y < 32 }
    override func mouseDragged(with event: NSEvent) {
        let mouse = NSEvent.mouseLocation; let dx = mouse.x - initialMouse.x, dy = mouse.y - initialMouse.y
        if resizing { let size = max(100, min(560, initialFrame.width + dx - dy)); window?.setFrame(CGRect(x: initialFrame.minX, y: initialFrame.maxY - size, width: size, height: size), display: true) }
        else { window?.setFrameOrigin(CGPoint(x: initialFrame.minX + dx, y: initialFrame.minY + dy)) }
    }
}

final class CaptureEngine: NSObject, SCStreamOutput, SCStreamDelegate, AVCaptureVideoDataOutputSampleBufferDelegate, @unchecked Sendable {
    static let shared = CaptureEngine()
    let queue = DispatchQueue(label: "screenrec.capture", qos: .userInitiated)
    private let cameraControlQueue = DispatchQueue(label: "screenrec.camera-control", qos: .userInitiated)
    private var stream: SCStream?; private var systemStream: SCStream?; private var cameraSession: AVCaptureSession?
    private var writers: [String: TrackWriter] = [:]
    private var origin = CMTime.zero; private var originResolved = false; private var pausedAt: CMTime?; private var pauseOffset = CMTime.zero
    private var settings: CaptureSettings?; private var projectID: String?; private var directory = ""
    private var sourceTitle = ""
    private var active = false; private var errorMessage: String?; private var stopping = false
    private var micLevel = 0.0, systemLevel = 0.0
    private var cursorBatch: [CursorEvent] = []; private var cursorFile: FileHandle?; private var cursorCount = 0
    private var cursorTimer: Timer?; private var captureRect = CGRect.zero; private var capturedWindowID: CGWindowID?
    private var cursorContentRect = CGRect(x: 0, y: 0, width: 1, height: 1)
    private var typingTap: CFMachPort?; private var typingRunLoopSource: CFRunLoopSource?; private var lastTypingMs = -1000.0
    private var lastInteractionPosition: CGPoint?; private var lastPointerPosition: CGPoint?; private var pointerPressed = false
    private var lastBoundsCheck = Date.distantPast; private var lastRecoveryMs = 0.0
    private var cameraRanges: [MediaRange] = []; private var cameraRangeStart: Double?
    private var startupInProgress = false; private var finalizing = false
    private var bubble: NSPanel?; private var bubbleView: CameraBubbleView?
    private var cameraVisible = false, cameraEnabled = false
    private var finalDuration = 0.0
    func status() -> [String: Any] {
        queue.sync {
            var result: [String: Any] = ["active": active, "paused": pausedAt != nil, "durationMs": active ? elapsedMs() : finalDuration, "microphoneLevel": micLevel, "systemLevel": systemLevel, "cameraVisible": cameraVisible, "cameraEnabled": cameraEnabled, "cameraRunning": cameraSession?.isRunning ?? false]
            if let projectID { result["projectId"] = projectID }; if let errorMessage { result["error"] = errorMessage }; return result
        }
    }
    private func elapsedMs() -> Double { originResolved ? max(0, milliseconds((pausedAt ?? CMClockGetTime(CMClockGetHostTimeClock())) - origin - pauseOffset)) : 0 }
    @MainActor func start(projectID: String, directory: String, settings: CaptureSettings) async throws -> [String: Any] {
        guard !startupInProgress, !finalizing, !(status()["active"] as? Bool ?? false) else { throw NativeFailure("A recording is already active.", code: "recording_active") }
        startupInProgress = true
        defer { startupInProgress = false }
        guard CGPreflightScreenCaptureAccess() else { throw NativeFailure("Screen recording permission is required.", code: "permission_required") }
        guard settings.width >= 64, settings.height >= 64, settings.width <= 3840, settings.height <= 2160, settings.width % 2 == 0, settings.height % 2 == 0, settings.fps == 30 else { throw NativeFailure("Capture supports even dimensions up to 3840×2160 at 30 fps.", code: "invalid_params") }
        if let id = settings.microphoneId, !id.isEmpty, AVCaptureDevice.authorizationStatus(for: .audio) != .authorized { throw NativeFailure("Microphone permission is required.", code: "permission_required") }
        if let id = settings.cameraId, !id.isEmpty, AVCaptureDevice.authorizationStatus(for: .video) != .authorized { throw NativeFailure("Camera permission is required.", code: "permission_required") }
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
        let numericID = UInt32(settings.sourceId.split(separator: ":").last ?? "")
        let filter: SCContentFilter
        var rectangle: CGRect, title: String
        if settings.sourceKind == "display", let display = content.displays.first(where: { $0.displayID == numericID }) {
            let ownApps = content.applications.filter { $0.processID == getpid() }
            filter = SCContentFilter(display: display, excludingApplications: ownApps, exceptingWindows: [])
            rectangle = CGDisplayBounds(display.displayID)
            title = "Display \(display.displayID)"
        } else if settings.sourceKind == "window", let window = content.windows.first(where: { $0.windowID == numericID }), window.owningApplication?.processID != getpid() {
            filter = SCContentFilter(desktopIndependentWindow: window); rectangle = window.frame; title = window.title ?? ""
        } else { throw NativeFailure("The selected screen/window no longer exists.", code: "source_unavailable") }
        if let region = settings.region {
            guard [region.x, region.y, region.width, region.height].allSatisfy({ $0.isFinite }), region.width > 0, region.height > 0, region.x >= 0, region.y >= 0, region.x + region.width <= rectangle.width, region.y + region.height <= rectangle.height else { throw NativeFailure("Capture region is outside the selected source.", code: "invalid_params") }
        }
        let mediaDir = URL(fileURLWithPath: directory, isDirectory: true).appendingPathComponent("media", isDirectory: true)
        try FileManager.default.createDirectory(at: mediaDir, withIntermediateDirectories: true)
        for file in ["screen.mov", "camera.mov", "microphone.mov", "system.mov", "cursor.json"] { guard !FileManager.default.fileExists(atPath: mediaDir.appendingPathComponent(file).path) else { throw NativeFailure("Project already contains a recording; create a new project.", code: "file_exists") } }
        var newWriters: [String: TrackWriter] = [:]
        var newCamera: AVCaptureSession?
        var startupSucceeded = false
        defer {
            if !startupSucceeded {
                for writer in newWriters.values { writer.writer.cancelWriting() }
                try? cursorFile?.close(); cursorFile = nil
                // These names were verified absent before this start transaction; never remove existing project assets.
                for file in ["screen.mov", "camera.mov", "microphone.mov", "system.mov", "cursor.json"] { try? FileManager.default.removeItem(at: mediaDir.appendingPathComponent(file)) }
                queue.sync { self.active = false; self.stream = nil; self.systemStream = nil; self.cameraSession = nil; self.writers = [:] }
            }
        }
        do {
            newWriters["screen"] = try TrackWriter(url: mediaDir.appendingPathComponent("screen.mov"), videoSize: CGSize(width: settings.width, height: settings.height))
            if settings.systemAudio { newWriters["systemAudio"] = try TrackWriter(url: mediaDir.appendingPathComponent("system.mov")) }
            if let id = settings.microphoneId, !id.isEmpty { newWriters["microphone"] = try TrackWriter(url: mediaDir.appendingPathComponent("microphone.mov")) }
            if let id = settings.cameraId, !id.isEmpty {
                guard let device = AVCaptureDevice(uniqueID: id) else { throw NativeFailure("Selected camera is unavailable.", code: "device_unavailable") }
                let session = AVCaptureSession(); session.beginConfiguration(); session.sessionPreset = .hd1280x720
                let input = try AVCaptureDeviceInput(device: device)
                guard session.canAddInput(input) else { throw NativeFailure("Cannot open camera.") }; session.addInput(input)
                let output = AVCaptureVideoDataOutput(); output.alwaysDiscardsLateVideoFrames = true; output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
                guard session.canAddOutput(output) else { throw NativeFailure("Cannot capture camera frames.") }; session.addOutput(output); output.setSampleBufferDelegate(self, queue: queue); session.commitConfiguration()
                newCamera = session
                newWriters["camera"] = try TrackWriter(url: mediaDir.appendingPathComponent("camera.mov"), videoSize: CGSize(width: 1280, height: 720))
            }
        } catch { for writer in newWriters.values { writer.writer.cancelWriting() }; throw error }
        let separateSystemAudio = settings.systemAudio && settings.sourceKind == "window"
        let config = SCStreamConfiguration(); config.width = settings.width; config.height = settings.height
        config.minimumFrameInterval = CMTime(value: 1, timescale: 30); config.queueDepth = 5; config.showsCursor = false
        config.pixelFormat = kCVPixelFormatType_32BGRA; config.scalesToFit = true; config.capturesAudio = settings.systemAudio && !separateSystemAudio; config.sampleRate = 48000; config.channelCount = 2
        config.excludesCurrentProcessAudio = true; config.captureDynamicRange = .SDR
        config.captureMicrophone = !(settings.microphoneId ?? "").isEmpty; config.microphoneCaptureDeviceID = settings.microphoneId
        if let region = settings.region {
            config.sourceRect = CGRect(x: region.x, y: region.y, width: region.width, height: region.height)
            rectangle = CGRect(x: rectangle.minX + region.x, y: rectangle.minY + region.y, width: region.width, height: region.height)
        }
        let newStream = SCStream(filter: filter, configuration: config, delegate: self)
        try newStream.addStreamOutput(self, type: .screen, sampleHandlerQueue: queue)
        if config.capturesAudio { try newStream.addStreamOutput(self, type: .audio, sampleHandlerQueue: queue) }
        if config.captureMicrophone { try newStream.addStreamOutput(self, type: .microphone, sampleHandlerQueue: queue) }
        var newSystemStream: SCStream?
        if separateSystemAudio {
            guard let display = content.displays.first else { throw NativeFailure("No display available for system audio.") }
            let audioFilter = SCContentFilter(display: display, excludingApplications: content.applications.filter { $0.processID == getpid() }, exceptingWindows: [])
            let audioConfig = SCStreamConfiguration(); audioConfig.width = 16; audioConfig.height = 16; audioConfig.minimumFrameInterval = CMTime(seconds: 1, preferredTimescale: 600)
            audioConfig.capturesAudio = true; audioConfig.sampleRate = 48000; audioConfig.channelCount = 2; audioConfig.excludesCurrentProcessAudio = true; audioConfig.showsCursor = false
            let audioStream = SCStream(filter: audioFilter, configuration: audioConfig, delegate: self)
            try audioStream.addStreamOutput(self, type: .audio, sampleHandlerQueue: queue)
            newSystemStream = audioStream
        }
        guard FileManager.default.createFile(atPath: mediaDir.appendingPathComponent("cursor.json").path, contents: Data("[".utf8)) else { throw NativeFailure("Could not create cursor metadata.") }
        let newCursorFile = try FileHandle(forWritingTo: mediaDir.appendingPathComponent("cursor.json")); try newCursorFile.seekToEnd()
        queue.sync {
            self.cursorFile = newCursorFile; self.cursorBatch = []; self.cursorCount = 0; self.lastRecoveryMs = 0
            self.cameraRanges = []; self.cameraRangeStart = nil; self.cursorContentRect = CGRect(x: 0, y: 0, width: 1, height: 1)
            self.sourceTitle = title; self.lastTypingMs = -1000; self.lastInteractionPosition = nil; self.lastPointerPosition = nil; self.pointerPressed = false
            self.capturedWindowID = settings.sourceKind == "window" ? numericID : nil
            self.writers = newWriters; self.stream = newStream; self.systemStream = newSystemStream; self.cameraSession = newCamera; self.settings = settings
            self.directory = directory; self.projectID = projectID; self.origin = CMClockGetTime(CMClockGetHostTimeClock()); self.originResolved = false
            self.pauseOffset = .zero; self.pausedAt = nil; self.active = true; self.stopping = false; self.errorMessage = nil
            self.cameraEnabled = newCamera != nil; self.cameraVisible = newCamera != nil; self.captureRect = rectangle; self.micLevel = 0; self.systemLevel = 0
        }
        do {
            if let newCamera { await withCheckedContinuation { continuation in cameraControlQueue.async { newCamera.startRunning(); continuation.resume() } } }
            if let newSystemStream { try await newSystemStream.startCapture() }
            try await newStream.startCapture()
        } catch {
            if let newSystemStream { try? await newSystemStream.stopCapture() }
            queue.sync { active = false; for writer in writers.values { writer.writer.cancelWriting() } }; newCamera?.stopRunning(); throw error
        }
        startupSucceeded = true
        if let newCamera { showBubble(session: newCamera, shape: settings.cameraShape) }
        cursorTimer = Timer.scheduledTimer(withTimeInterval: 1 / 30, repeats: true) { [weak self] _ in self?.sampleCursor() }
        startTypingMonitoring()
        return status()
    }
    @MainActor private func showBubble(session: AVCaptureSession, shape: String) {
        let panel = NSPanel(contentRect: CGRect(x: 70, y: 70, width: 220, height: 220), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.level = .floating; panel.isOpaque = false; panel.backgroundColor = .clear; panel.hasShadow = true; panel.hidesOnDeactivate = false
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        let view = CameraBubbleView(frame: CGRect(x: 0, y: 0, width: 220, height: 220)); view.shape = shape; view.preview.session = session
        panel.contentView = view; panel.orderFrontRegardless(); bubble = panel; bubbleView = view
    }
    private func sampleCursor() {
        let position = NSEvent.mouseLocation
        let point = CGPoint(x: position.x, y: CGDisplayBounds(CGMainDisplayID()).height - position.y)
        let clicking = NSEvent.pressedMouseButtons != 0
        if Date().timeIntervalSince(lastBoundsCheck) > 0.5 {
            lastBoundsCheck = Date()
            if let id = capturedWindowID, let info = CGWindowListCopyWindowInfo(.optionIncludingWindow, id) as? [[String: Any]], let bounds = info.first?[kCGWindowBounds as String] as? [String: Any], let rect = CGRect(dictionaryRepresentation: bounds as CFDictionary) {
                queue.async {
                    if let r = self.settings?.region { self.captureRect = CGRect(x: rect.minX + r.x, y: rect.minY + r.y, width: r.width, height: r.height) }
                    else { self.captureRect = rect }
                }
            }
        }
        queue.async {
            guard self.active, self.pausedAt == nil, self.originResolved else { return }
            let elapsed = self.elapsedMs()
            if let p = cursorPosition(point, captureRect: self.captureRect, normalizedContentRect: self.cursorContentRect) {
                let moved = self.lastPointerPosition.map { hypot(p.x - $0.x, p.y - $0.y) > 0.002 } ?? false
                let kind: String? = clicking && !self.pointerPressed ? "click" : clicking && moved ? "drag" : nil
                if clicking { self.lastInteractionPosition = p }
                self.lastPointerPosition = p; self.cursorBatch.append(CursorEvent(tMs: elapsed, x: p.x, y: p.y, click: clicking, kind: kind))
            }
            self.pointerPressed = clicking
            do {
                if self.cursorBatch.count >= 60 { try self.flushCursor() }
                if elapsed - self.lastRecoveryMs >= 5000 { try self.persistRecovery(duration: elapsed); self.lastRecoveryMs = elapsed }
            } catch { self.errorMessage = error.localizedDescription; Task { @MainActor in if self.status()["active"] as? Bool == true { _ = try? await self.stop() } } }
        }
    }
    private func flushCursor() throws {
        guard let cursorFile, !cursorBatch.isEmpty else { return }
        var data = Data()
        for event in cursorBatch { if cursorCount > 0 { data.append(44) }; data.append(try JSONEncoder().encode(event)); cursorCount += 1 }
        try cursorFile.write(contentsOf: data); cursorBatch.removeAll(keepingCapacity: true)
    }
    @MainActor private func startTypingMonitoring() {
        stopTypingMonitoring()
        guard CGPreflightListenEventAccess() else { return }
        let mask = CGEventMask(1) << CGEventType.keyDown.rawValue
        guard let tap = CGEvent.tapCreate(tap: .cgSessionEventTap, place: .tailAppendEventTap, options: .listenOnly, eventsOfInterest: mask, callback: { _, type, event, context in
            if let context {
                // The singleton outlives its tap. Its source runs on the main run loop;
                // only the event type is used, never text, keycodes or other fields.
                let engine = Unmanaged<CaptureEngine>.fromOpaque(context).takeUnretainedValue()
                if type == .keyDown { engine.sampleTyping() }
                else if type == .tapDisabledByTimeout, CGPreflightListenEventAccess(), let tap = engine.typingTap { CGEvent.tapEnable(tap: tap, enable: true) }
                // A tap disabled by user input stays disabled until the next recording.
            }
            return Unmanaged.passUnretained(event)
        }, userInfo: Unmanaged.passUnretained(self).toOpaque()) else { return }
        guard let source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0) else { CFMachPortInvalidate(tap); return }
        typingTap = tap; typingRunLoopSource = source
        CFRunLoopAddSource(CFRunLoopGetMain(), source, .commonModes)
    }
    @MainActor private func stopTypingMonitoring() {
        if let tap = typingTap { CGEvent.tapEnable(tap: tap, enable: false) }
        if let source = typingRunLoopSource { CFRunLoopRemoveSource(CFRunLoopGetMain(), source, .commonModes); CFRunLoopSourceInvalidate(source) }
        if let tap = typingTap { CFMachPortInvalidate(tap) }
        typingRunLoopSource = nil; typingTap = nil
    }
    private func sampleTyping() {
        let mouse = NSEvent.mouseLocation, point = CGPoint(x: mouse.x, y: CGDisplayBounds(CGMainDisplayID()).height - mouse.y)
        queue.async {
            guard self.active, self.pausedAt == nil, self.originResolved else { return }
            let elapsed = self.elapsedMs(); guard elapsed - self.lastTypingMs >= 600 else { return }
            guard let current = cursorPosition(point, captureRect: self.captureRect, normalizedContentRect: self.cursorContentRect) else { return }
            let focus = self.lastInteractionPosition ?? current
            self.cursorBatch.append(CursorEvent(tMs: elapsed, x: focus.x, y: focus.y, click: nil, kind: "typing")); self.lastTypingMs = elapsed
            do { if self.cursorBatch.count >= 60 { try self.flushCursor() } }
            catch { self.errorMessage = error.localizedDescription; Task { @MainActor in if self.status()["active"] as? Bool == true { _ = try? await self.stop() } } }
        }
    }
    private func currentSource(duration: Double) -> RecordingSource? {
        guard let settings else { return nil }
        var ranges = cameraRanges.map { MediaRange(startMs: max(0, $0.startMs), endMs: min(duration, $0.endMs)) }.filter { $0.endMs > $0.startMs }
        if let start = cameraRangeStart, duration > start { ranges.append(MediaRange(startMs: start, endMs: duration)) }
        return RecordingSource(durationMs: duration, width: settings.width, height: settings.height, fps: 30, screen: "media/screen.mov", camera: (writers["camera"]?.samples ?? 0) > 0 ? "media/camera.mov" : nil, microphone: (writers["microphone"]?.samples ?? 0) > 0 ? "media/microphone.mov" : nil, systemAudio: (writers["systemAudio"]?.samples ?? 0) > 0 ? "media/system.mov" : nil, cursor: "media/cursor.json", cameraActiveRanges: ranges, title: sourceTitle)
    }
    private func persistRecovery(duration: Double) throws {
        try flushCursor(); try cursorFile?.synchronize()
        if let source = currentSource(duration: duration), (writers["screen"]?.samples ?? 0) > 0 { try JSONEncoder().encode(source).write(to: URL(fileURLWithPath: directory).appendingPathComponent("recovered-source.json"), options: .atomic) }
    }
    func pause() throws -> [String: Any] { try queue.sync { guard active else { throw NativeFailure("No active recording.") }; if pausedAt == nil { pausedAt = CMClockGetTime(CMClockGetHostTimeClock()) } }; return status() }
    func resume() throws -> [String: Any] { try queue.sync { guard active else { throw NativeFailure("No active recording.") }; if let t = pausedAt { pauseOffset = pauseOffset + CMClockGetTime(CMClockGetHostTimeClock()) - t; pausedAt = nil } }; return status() }
    @MainActor func camera(_ params: [String: Any]) async -> [String: Any] {
        guard !finalizing, !startupInProgress, status()["active"] as? Bool == true else { return status() }
        let requestedEnabled = params["enabled"] as? Bool
        queue.sync {
            if let visible = params["visible"] as? Bool { cameraVisible = visible }
            if requestedEnabled != nil {
                cameraEnabled = false
                if let start = cameraRangeStart { let end = elapsedMs(); if end > start { cameraRanges.append(MediaRange(startMs: start, endMs: end)) }; cameraRangeStart = nil }
            }
        }
        if let enabled = requestedEnabled, let session = cameraSession {
            await withCheckedContinuation { continuation in cameraControlQueue.async { if enabled { session.startRunning() } else { session.stopRunning() }; continuation.resume() } }
            queue.sync { cameraEnabled = enabled && active }
        }
        if let shape = params["shape"] as? String { bubbleView?.shape = shape == "square" ? "square" : "circle" }
        let s = status(); if s["cameraVisible"] as? Bool == true && s["cameraEnabled"] as? Bool == true { bubble?.orderFrontRegardless() } else { bubble?.orderOut(nil) }; return s
    }
    @MainActor func stop() async throws -> [String: Any] {
        guard !finalizing, status()["active"] as? Bool == true else { throw NativeFailure("No active recording or finalization is already underway.") }
        finalizing = true; defer { finalizing = false }
        cursorTimer?.invalidate(); cursorTimer = nil; bubble?.close(); bubble = nil; bubbleView = nil
        stopTypingMonitoring()
        let end = queue.sync { () -> CMTime in stopping = true; finalDuration = elapsedMs(); return mediaTime(finalDuration) }
        if let stream { try? await stream.stopCapture() }
        if let systemStream { try? await systemStream.stopCapture() }
        if let cameraSession { await withCheckedContinuation { continuation in cameraControlQueue.async { cameraSession.stopRunning(); continuation.resume() } } }
        let snapshot = queue.sync { () -> [String: TrackWriter] in active = false; return writers }
        defer { queue.sync { try? cursorFile?.close(); cursorFile = nil; self.stream = nil; self.systemStream = nil; self.cameraSession = nil; writers = [:]; pausedAt = nil; cameraEnabled = false; cameraVisible = false } }
        var finishError: Error?
        for writer in snapshot.values { do { try await writer.finish(at: end) } catch { finishError = error } }
        guard let screen = snapshot["screen"], screen.samples > 0, let source = queue.sync(execute: { currentSource(duration: finalDuration) }) else { throw finishError ?? NativeFailure("Screen recording produced no frames; check permission and source.") }
        try queue.sync { try persistRecovery(duration: finalDuration); try cursorFile?.write(contentsOf: Data("]".utf8)); try cursorFile?.close(); cursorFile = nil }
        if let finishError { throw finishError }
        return ["source": try jsonObject(source)]
    }
    func stream(_ stream: SCStream, didStopWithError error: Error) { queue.async { self.errorMessage = error.localizedDescription }; Task { @MainActor in if self.status()["active"] as? Bool == true { _ = try? await self.stop() } } }
    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard sampleBuffer.isValid, active, pausedAt == nil else { return }
        if type == .screen {
            if let info = (CMSampleBufferGetSampleAttachmentsArray(sampleBuffer, createIfNecessary: false) as? [[SCStreamFrameInfo: Any]])?.first {
                if let raw = info[.status] as? Int, raw != SCFrameStatus.complete.rawValue { return }
                // SCK preserves aspect ratio and may align content to an edge rather than center it.
                // contentRect is already scaled, in surface points; scaleFactor converts it to pixels.
                if let value = info[.contentRect] as? [String: Any], let rect = CGRect(dictionaryRepresentation: value as CFDictionary), let factor = info[.scaleFactor] as? CGFloat, let buffer = sampleBuffer.imageBuffer, rect.width > 0, rect.height > 0, rect.minX.isFinite, rect.minY.isFinite {
                    let sx = factor / CGFloat(CVPixelBufferGetWidth(buffer)), sy = factor / CGFloat(CVPixelBufferGetHeight(buffer))
                    cursorContentRect = CGRect(x: rect.minX * sx, y: rect.minY * sy, width: rect.width * sx, height: rect.height * sy)
                }
                if capturedWindowID != nil, settings?.region == nil, let value = info[.screenRect] as? [String: Any], let rect = CGRect(dictionaryRepresentation: value as CFDictionary), rect.width > 0, rect.height > 0 { captureRect = rect }
            }
            consume(sampleBuffer, kind: "screen", clock: stream.synchronizationClock)
        } else if type == .audio { consume(sampleBuffer, kind: "systemAudio", clock: stream.synchronizationClock) }
        else if type == .microphone { consume(sampleBuffer, kind: "microphone", clock: stream.synchronizationClock) }
    }
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) { guard active, pausedAt == nil, cameraEnabled else { return }; consume(sampleBuffer, kind: "camera", clock: cameraSession?.synchronizationClock) }
    private func consume(_ sample: CMSampleBuffer, kind: String, clock: CMClock?) {
        guard let writer = writers[kind] else { return }
        if !originResolved {
            guard kind == "screen" else { return }
            origin = clock.map { CMSyncConvertTime(sample.presentationTimeStamp, from: $0, to: CMClockGetHostTimeClock()) } ?? sample.presentationTimeStamp
            originResolved = true; pauseOffset = .zero
        }
        var count = 0
        guard CMSampleBufferGetSampleTimingInfoArray(sample, entryCount: 0, arrayToFill: nil, entriesNeededOut: &count) == noErr, count > 0 else { return }
        var timing = [CMSampleTimingInfo](repeating: CMSampleTimingInfo(duration: .invalid, presentationTimeStamp: .invalid, decodeTimeStamp: .invalid), count: count)
        guard CMSampleBufferGetSampleTimingInfoArray(sample, entryCount: count, arrayToFill: &timing, entriesNeededOut: &count) == noErr else { return }
        for index in timing.indices {
            let pts = clock.map { CMSyncConvertTime(timing[index].presentationTimeStamp, from: $0, to: CMClockGetHostTimeClock()) } ?? timing[index].presentationTimeStamp
            timing[index].presentationTimeStamp = pts - origin - pauseOffset; timing[index].decodeTimeStamp = .invalid
        }
        guard timing[0].presentationTimeStamp >= .zero, !stopping || milliseconds(timing[0].presentationTimeStamp) < finalDuration else { return }
        var retimed: CMSampleBuffer?
        guard CMSampleBufferCreateCopyWithNewTiming(allocator: kCFAllocatorDefault, sampleBuffer: sample, sampleTimingEntryCount: count, sampleTimingArray: &timing, sampleBufferOut: &retimed) == noErr, let retimed else { return }
        do {
            let before = writer.samples; try writer.append(retimed)
            if kind == "camera", cameraRangeStart == nil, writer.samples > before { cameraRangeStart = milliseconds(timing[0].presentationTimeStamp) }
        } catch {
            errorMessage = error.localizedDescription; stopping = true
            Task { @MainActor in if self.status()["active"] as? Bool == true { _ = try? await self.stop() } }
        }
        if kind == "microphone" || kind == "systemAudio" {
            let level = Self.level(sample); if kind == "microphone" { micLevel = level } else { systemLevel = level }
        }
    }
    private static func level(_ buffer: CMSampleBuffer) -> Double {
        guard let block = CMSampleBufferGetDataBuffer(buffer), let format = buffer.formatDescription, let asbd = CMAudioFormatDescriptionGetStreamBasicDescription(format)?.pointee else { return 0 }
        var length = 0; var pointer: UnsafeMutablePointer<Int8>?
        guard CMBlockBufferGetDataPointer(block, atOffset: 0, lengthAtOffsetOut: nil, totalLengthOut: &length, dataPointerOut: &pointer) == noErr, let pointer else { return 0 }
        var sum = 0.0, count = 0
        if asbd.mBitsPerChannel == 32 && asbd.mFormatFlags & kAudioFormatFlagIsFloat != 0 {
            pointer.withMemoryRebound(to: Float.self, capacity: length / 4) { p in for i in 0..<(length / 4) { sum += Double(p[i] * p[i]); count += 1 } }
        } else if asbd.mBitsPerChannel == 16 { pointer.withMemoryRebound(to: Int16.self, capacity: length / 2) { p in for i in 0..<(length / 2) { let x = Double(p[i]) / 32768; sum += x * x; count += 1 } } }
        return count > 0 ? min(1, sqrt(sum / Double(count))) : 0
    }
}
