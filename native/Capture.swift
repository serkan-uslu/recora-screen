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

// A dedicated run loop keeps tracking alive while macOS menus or window drags own the main loop.
// Only pointer geometry and activity markers leave this monitor; key contents are never read.
final class CaptureInputMonitor: @unchecked Sendable {
    struct Sample {
        var hostTime: CMTime; var point: CGPoint; var pressed: Bool; var kind: String?
        var focusedWindow: CGWindowID? = nil
    }
    private let lock = NSLock()
    private var loop: CFRunLoop?; private var tap: CFMachPort?
    private var stopping = false; private var stopWaiters: [CheckedContinuation<Void, Never>] = []
    let receive: (Sample) -> Void
    let state: (String, String?) -> Void
    init(receive: @escaping (Sample) -> Void, state: @escaping (String, String?) -> Void) { self.receive = receive; self.state = state }
    static func pointer() -> CGPoint { CGEvent(source: nil)?.location ?? .zero }
    static func pressed() -> Bool { CGEventSource.buttonState(.combinedSessionState, button: .left) || CGEventSource.buttonState(.combinedSessionState, button: .right) || CGEventSource.buttonState(.combinedSessionState, button: .center) }
    static func focusedWindow() -> CGWindowID? {
        guard let pid = NSWorkspace.shared.frontmostApplication?.processIdentifier,
              let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else { return nil }
        return windows.first { ($0[kCGWindowOwnerPID as String] as? Int32) == pid && ($0[kCGWindowLayer as String] as? Int) == 0 }?[kCGWindowNumber as String] as? CGWindowID
    }
    func start() async {
        await withCheckedContinuation { ready in
            let thread = Thread { [self] in
                let runLoop = CFRunLoopGetCurrent()!
                lock.lock(); loop = runLoop; lock.unlock()
                let types: [CGEventType] = [.leftMouseDown, .rightMouseDown, .otherMouseDown, .leftMouseUp, .rightMouseUp, .otherMouseUp, .leftMouseDragged, .rightMouseDragged, .otherMouseDragged, .keyDown]
                let mask = types.reduce(CGEventMask(0)) { $0 | (CGEventMask(1) << $1.rawValue) }
                var source: CFRunLoopSource?
                if CGPreflightListenEventAccess() {
                    tap = CGEvent.tapCreate(tap: .cgSessionEventTap, place: .tailAppendEventTap, options: .listenOnly, eventsOfInterest: mask, callback: { _, type, event, context in
                        guard let context else { return Unmanaged.passUnretained(event) }
                        let monitor = Unmanaged<CaptureInputMonitor>.fromOpaque(context).takeUnretainedValue()
                        monitor.handle(type, event: event)
                        return Unmanaged.passUnretained(event)
                    }, userInfo: Unmanaged.passUnretained(self).toOpaque())
                    if let tap { source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0) }
                    if let source { CFRunLoopAddSource(runLoop, source, .commonModes); state("active", nil) }
                    else { state("failed", "Input monitoring could not start. Reopen the app after granting Input Monitoring permission.") }
                } else { state("unavailable", "Input Monitoring is off. Pointer movement still records; typing and short-click detection require permission.") }
                let timer = CFRunLoopTimerCreateWithHandler(kCFAllocatorDefault, CFAbsoluteTimeGetCurrent(), 1 / 30, 0, 0) { [self] _ in
                    receive(Sample(hostTime: CMClockGetTime(CMClockGetHostTimeClock()), point: Self.pointer(), pressed: Self.pressed(), kind: nil))
                }!
                CFRunLoopAddTimer(runLoop, timer, .commonModes)
                ready.resume()
                lock.lock(); let shouldRun = !stopping; lock.unlock()
                if shouldRun { CFRunLoopRun() }
                CFRunLoopTimerInvalidate(timer)
                if let source { CFRunLoopRemoveSource(runLoop, source, .commonModes); CFRunLoopSourceInvalidate(source) }
                if let tap { CFMachPortInvalidate(tap) }; tap = nil
                lock.lock(); loop = nil; let waiters = stopWaiters; stopWaiters = []; lock.unlock()
                for waiter in waiters { waiter.resume() }
            }
            thread.name = "screenrec.input"; thread.qualityOfService = .userInteractive; thread.start()
        }
    }
    static func activity(for type: CGEventType) -> String? {
        switch type {
        case .keyDown: return "typing"
        case .leftMouseDown, .rightMouseDown, .otherMouseDown: return "click"
        case .leftMouseDragged, .rightMouseDragged, .otherMouseDragged: return "drag"
        default: return nil
        }
    }
    private func handle(_ type: CGEventType, event: CGEvent) {
        if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
            if type == .tapDisabledByTimeout, CGPreflightListenEventAccess(), let tap {
                CGEvent.tapEnable(tap: tap, enable: true)
                if CGEvent.tapIsEnabled(tap: tap) { state("active", nil); return }
            }
            state("failed", "Input monitoring stopped. Pointer movement continues; restart recording to restore input events."); return
        }
        let kind = Self.activity(for: type)
        let down = type == .leftMouseDown || type == .rightMouseDown || type == .otherMouseDown
        let up = type == .leftMouseUp || type == .rightMouseUp || type == .otherMouseUp
        receive(Sample(hostTime: CMClockGetTime(CMClockGetHostTimeClock()), point: event.location, pressed: down || (!up && Self.pressed()), kind: kind, focusedWindow: kind == "typing" ? Self.focusedWindow() : nil))
    }
    func stop() async {
        await withCheckedContinuation { continuation in
            lock.lock(); stopping = true
            guard let loop else { lock.unlock(); continuation.resume(); return }
            stopWaiters.append(continuation); lock.unlock()
            CFRunLoopPerformBlock(loop, CFRunLoopMode.commonModes.rawValue) { CFRunLoopStop(loop) }; CFRunLoopWakeUp(loop)
        }
    }
}

func typingPosition(point: CGPoint, lastInteraction: CGPoint?, captureRect: CGRect, contentRect: CGRect, capturedWindow: CGWindowID?, focusedWindow: CGWindowID?) -> CGPoint? {
    if let capturedWindow, capturedWindow != focusedWindow { return nil }
    // A focused captured window still receives typing when the pointer has left its bounds.
    return lastInteraction ?? cursorPosition(point, captureRect: captureRect, normalizedContentRect: contentRect) ?? (capturedWindow != nil ? CGPoint(x: contentRect.midX, y: contentRect.midY) : nil)
}

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
    private var inputMonitor: CaptureInputMonitor?; private var captureRect = CGRect.zero; private var capturedWindowID: CGWindowID?
    private var cursorContentRect = CGRect(x: 0, y: 0, width: 1, height: 1)
    private var lastTypingMs = -1000.0
    private var inputState = "inactive", inputMessage: String?
    private var pointerSamples = 0, clickCount = 0, dragCount = 0, typingCount = 0; private var firstPointerMs: Double?
    private let statusLock = NSLock()
    private var cachedStatus: [String: Any] = ["active": false, "paused": false, "durationMs": 0, "phase": "idle", "cameraEnabled": false, "cameraVisible": false, "cameraRunning": false, "microphoneLevel": 0, "systemLevel": 0, "monitoring": ["pointer": "inactive", "input": "inactive", "pointerSamples": 0, "clicks": 0, "drags": 0, "typingEvents": 0]]
    private let inputLock = NSLock(); private var pendingInput: [CaptureInputMonitor.Sample] = []; private var drainingInput = false; private var inputOverflowed = false
    private var lastInteractionPosition: CGPoint?; private var lastPointerPosition: CGPoint?; private var pointerPressed = false
    private var lastBoundsCheck = Date.distantPast; private var lastRecoveryMs = 0.0
    private var cameraRanges: [MediaRange] = []; private var cameraRangeStart: Double?
    private var startupInProgress = false; private var finalizing = false
    private var bubble: NSPanel?; private var bubbleView: CameraBubbleView?
    private var cameraVisible = false, cameraEnabled = false
    private var finalDuration = 0.0
    func status() -> [String: Any] { statusLock.lock(); defer { statusLock.unlock() }; return cachedStatus }
    // Called on the capture queue; readers never wait for encoders, filesystem sync or device setup.
    private func publishStatus() {
        var monitor: [String: Any] = ["pointer": inputMonitor != nil && active && !stopping ? "active" : "inactive", "input": inputState, "pointerSamples": pointerSamples, "clicks": clickCount, "drags": dragCount, "typingEvents": typingCount]
        if let inputMessage { monitor["message"] = inputMessage }; if let firstPointerMs { monitor["firstPointerMs"] = firstPointerMs }
        let phase = finalizing ? "finalizing" : startupInProgress ? "starting" : active ? (pausedAt == nil ? "recording" : "paused") : "idle"
        var result: [String: Any] = ["active": active || startupInProgress || finalizing, "paused": pausedAt != nil, "durationMs": active && !stopping ? elapsedMs() : finalDuration, "phase": phase, "monitoring": monitor, "microphoneLevel": micLevel, "systemLevel": systemLevel, "cameraVisible": cameraVisible, "cameraEnabled": cameraEnabled, "cameraRunning": cameraEnabled]
        if let projectID { result["projectId"] = projectID }; if let errorMessage { result["error"] = errorMessage }
        statusLock.lock(); cachedStatus = result; statusLock.unlock()
    }
    private func elapsedMs() -> Double { originResolved ? max(0, milliseconds((pausedAt ?? CMClockGetTime(CMClockGetHostTimeClock())) - origin - pauseOffset)) : 0 }
    func start(projectID: String, directory: String, settings: CaptureSettings) async throws -> [String: Any] {
        try queue.sync {
            guard !startupInProgress, !finalizing, !active else { throw NativeFailure("A recording is already active.", code: "recording_active") }
            startupInProgress = true; self.projectID = projectID; finalDuration = 0; errorMessage = nil; inputState = "inactive"; inputMessage = nil; pointerSamples = 0; clickCount = 0; dragCount = 0; typingCount = 0; firstPointerMs = nil; publishStatus()
        }
        defer { queue.sync { startupInProgress = false; publishStatus() } }
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
            self.sourceTitle = title; self.lastTypingMs = -1000; self.pointerSamples = 0; self.clickCount = 0; self.dragCount = 0; self.typingCount = 0; self.firstPointerMs = nil; self.lastBoundsCheck = .distantPast; self.lastInteractionPosition = nil; self.lastPointerPosition = nil; self.pointerPressed = false
            self.capturedWindowID = settings.sourceKind == "window" ? numericID : nil
            self.writers = newWriters; self.stream = newStream; self.systemStream = newSystemStream; self.cameraSession = newCamera; self.settings = settings
            self.directory = directory; self.projectID = projectID; self.origin = CMClockGetTime(CMClockGetHostTimeClock()); self.originResolved = false
            self.pauseOffset = .zero; self.pausedAt = nil; self.active = true; self.stopping = false; self.errorMessage = nil
            self.cameraEnabled = newCamera != nil; self.cameraVisible = newCamera != nil; self.captureRect = rectangle; self.micLevel = 0; self.systemLevel = 0
        }
        let monitor = CaptureInputMonitor(receive: { [weak self] sample in self?.enqueueInput(sample) }, state: { [weak self] state, message in
            self?.queue.async { guard let self else { return }; self.inputState = state; self.inputMessage = message; self.publishStatus() }
        })
        queue.sync { inputMonitor = monitor; publishStatus() }
        await monitor.start()
        do {
            if let newCamera { await withCheckedContinuation { continuation in cameraControlQueue.async { newCamera.startRunning(); continuation.resume() } } }
            if let newSystemStream { try await newSystemStream.startCapture() }
            try await newStream.startCapture()
        } catch {
            let hasFrames = queue.sync { (writers["screen"]?.samples ?? 0) > 0 }
            if hasFrames {
                // A driver can fail after delivering valid frames. Keep those files and recovery metadata.
                startupSucceeded = true
                queue.sync { startupInProgress = false }
                _ = try? await stop()
            } else {
                if let newSystemStream { try? await newSystemStream.stopCapture() }
                await monitor.stop()
                queue.sync { active = false; inputMonitor = nil; inputState = "inactive"; for writer in writers.values { writer.writer.cancelWriting() }; publishStatus() }
                newCamera?.stopRunning()
            }
            throw error
        }
        startupSucceeded = true
        if let newCamera { await showBubble(session: newCamera, shape: settings.cameraShape) }
        queue.sync { startupInProgress = false; publishStatus() }
        return status()
    }
    @MainActor private func showBubble(session: AVCaptureSession, shape: String) {
        let panel = NSPanel(contentRect: CGRect(x: 70, y: 70, width: 220, height: 220), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.level = .floating; panel.isOpaque = false; panel.backgroundColor = .clear; panel.hasShadow = true; panel.hidesOnDeactivate = false
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        let view = CameraBubbleView(frame: CGRect(x: 0, y: 0, width: 220, height: 220)); view.shape = shape; view.preview.session = session
        panel.contentView = view; panel.orderFrontRegardless(); bubble = panel; bubbleView = view
    }
    private func enqueueInput(_ sample: CaptureInputMonitor.Sample) {
        inputLock.lock()
        // Bound retained input during a stalled media/disk queue. Stop safely rather than grow with recording duration.
        if pendingInput.count < 4096 { pendingInput.append(sample) } else { inputOverflowed = true }
        let schedule = !drainingInput; drainingInput = true; inputLock.unlock()
        guard schedule else { return }
        queue.async { [self] in
            inputLock.lock(); let samples = pendingInput, overflowed = inputOverflowed
            pendingInput = []; inputOverflowed = false; drainingInput = false; inputLock.unlock()
            for sample in samples { sampleInput(sample) }
            if overflowed { failRecording(NativeFailure("The recording disk cannot keep up with input metadata. Recording stopped; completed media is preserved.")) }
        }
    }
    private func sampleInput(_ sample: CaptureInputMonitor.Sample) {
        guard active, !stopping, pausedAt == nil, originResolved else { return }
        let elapsed = milliseconds(sample.hostTime - origin - pauseOffset)
        guard elapsed >= 0 else { return }
        if Date().timeIntervalSince(lastBoundsCheck) > 0.5 {
            lastBoundsCheck = Date()
            if let id = capturedWindowID, let info = CGWindowListCopyWindowInfo(.optionIncludingWindow, id) as? [[String: Any]], let bounds = info.first?[kCGWindowBounds as String] as? [String: Any], let rect = CGRect(dictionaryRepresentation: bounds as CFDictionary) {
                if let r = settings?.region { captureRect = CGRect(x: rect.minX + r.x, y: rect.minY + r.y, width: r.width, height: r.height) }
                else { captureRect = rect }
            }
        }
        defer { publishStatus() }
        if sample.kind == "typing" {
            guard elapsed - lastTypingMs >= 600, let focus = typingPosition(point: sample.point, lastInteraction: lastInteractionPosition, captureRect: captureRect, contentRect: cursorContentRect, capturedWindow: capturedWindowID, focusedWindow: sample.focusedWindow) else { return }
            cursorBatch.append(CursorEvent(tMs: elapsed, x: focus.x, y: focus.y, click: nil, kind: "typing")); lastTypingMs = elapsed; typingCount += 1
        } else {
            if let p = cursorPosition(sample.point, captureRect: captureRect, normalizedContentRect: cursorContentRect) {
                let moved = lastPointerPosition.map { hypot(p.x - $0.x, p.y - $0.y) > 0.002 } ?? false
                let kind = sample.kind ?? (inputState != "active" ? (sample.pressed && !pointerPressed ? "click" : sample.pressed && moved ? "drag" : nil) : nil)
                if sample.pressed { lastInteractionPosition = p }
                lastPointerPosition = p; cursorBatch.append(CursorEvent(tMs: elapsed, x: p.x, y: p.y, click: sample.pressed, kind: kind))
                pointerSamples += 1; if firstPointerMs == nil { firstPointerMs = elapsed }
                if kind == "click" { clickCount += 1 }; if kind == "drag" { dragCount += 1 }
            }
            pointerPressed = sample.pressed
        }
        do {
            if cursorBatch.count >= 60 { try flushCursor() }
            if elapsed - lastRecoveryMs >= 5000 { try persistRecovery(duration: elapsed); lastRecoveryMs = elapsed }
        } catch { failRecording(error) }
    }
    private func failRecording(_ error: Error) {
        guard errorMessage == nil else { return }
        errorMessage = error.localizedDescription; finalDuration = elapsedMs(); stopping = true; publishStatus()
        Task {
            while self.status()["phase"] as? String == "starting" { try? await Task.sleep(nanoseconds: 10_000_000) }
            if self.status()["active"] as? Bool == true { _ = try? await self.stop() }
        }
    }
    private func flushCursor() throws {
        guard let cursorFile, !cursorBatch.isEmpty else { return }
        var data = Data()
        let encoder = JSONEncoder(), offset = try cursorFile.offset()
        for (index, event) in cursorBatch.enumerated() { if cursorCount + index > 0 { data.append(44) }; data.append(try encoder.encode(event)) }
        do { try cursorFile.write(contentsOf: data) }
        catch {
            // Do not leave a partial JSON event in front of a later recovery flush.
            try? cursorFile.truncate(atOffset: offset); try? cursorFile.seek(toOffset: offset); throw error
        }
        cursorCount += cursorBatch.count; cursorBatch.removeAll(keepingCapacity: true)
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
    func pause() async throws -> [String: Any] { try queue.sync { guard active, !startupInProgress, !finalizing else { throw NativeFailure("No active recording or a recording transition is underway.") }; if pausedAt == nil { pausedAt = CMClockGetTime(CMClockGetHostTimeClock()) }; publishStatus() }; return status() }
    func resume() async throws -> [String: Any] { try queue.sync { guard active, !startupInProgress, !finalizing else { throw NativeFailure("No active recording or a recording transition is underway.") }; if let t = pausedAt { pauseOffset = pauseOffset + CMClockGetTime(CMClockGetHostTimeClock()) - t; pausedAt = nil }; publishStatus() }; return status() }
    func camera(_ params: [String: Any]) async -> [String: Any] {
        guard queue.sync(execute: { !finalizing && !startupInProgress && active }) else { return status() }
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
            queue.sync { cameraEnabled = enabled && active && !stopping }
        }
        queue.sync { publishStatus() }
        let s = status()
        await MainActor.run {
            if let shape = params["shape"] as? String { bubbleView?.shape = shape == "square" ? "square" : "circle" }
            if s["cameraVisible"] as? Bool == true && s["cameraEnabled"] as? Bool == true { bubble?.orderFrontRegardless() } else { bubble?.orderOut(nil) }
        }
        return s
    }
    func stop() async throws -> [String: Any] {
        let end = try queue.sync { () -> CMTime in
            guard !finalizing, !startupInProgress, active else { throw NativeFailure("No active recording or finalization is already underway.") }
            finalizing = true; if !stopping { finalDuration = elapsedMs() }; stopping = true; publishStatus(); return mediaTime(finalDuration)
        }
        defer { queue.sync { finalizing = false; publishStatus() } }
        await MainActor.run { bubble?.close(); bubble = nil; bubbleView = nil }
        await inputMonitor?.stop()
        queue.sync { inputMonitor = nil; inputState = "inactive"; publishStatus() }
        if let stream { try? await stream.stopCapture() }
        if let systemStream { try? await systemStream.stopCapture() }
        if let cameraSession { await withCheckedContinuation { continuation in cameraControlQueue.async { cameraSession.stopRunning(); continuation.resume() } } }
        let snapshot = queue.sync { () -> [String: TrackWriter] in active = false; return writers }
        defer { queue.sync { try? cursorFile?.close(); cursorFile = nil; self.stream = nil; self.systemStream = nil; self.cameraSession = nil; writers = [:]; pausedAt = nil; cameraEnabled = false; cameraVisible = false; publishStatus() } }
        var finishError: Error?
        for writer in snapshot.values { do { try await writer.finish(at: end) } catch { finishError = error } }
        guard let screen = snapshot["screen"], screen.samples > 0, let source = queue.sync(execute: { currentSource(duration: finalDuration) }) else { throw finishError ?? NativeFailure("Screen recording produced no frames; check permission and source.") }
        try queue.sync { try persistRecovery(duration: finalDuration); try cursorFile?.write(contentsOf: Data("]".utf8)); try cursorFile?.close(); cursorFile = nil }
        if let finishError { throw finishError }
        return ["source": try jsonObject(source)]
    }
    func stream(_ stream: SCStream, didStopWithError error: Error) { queue.async { if !self.finalizing { self.failRecording(error) } } }
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
            // Seed the first frame immediately, before startup waits for camera/system audio return.
            sampleInput(CaptureInputMonitor.Sample(hostTime: origin, point: CaptureInputMonitor.pointer(), pressed: CaptureInputMonitor.pressed(), kind: nil))
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
        } catch { failRecording(error) }
        if kind == "microphone" || kind == "systemAudio" {
            let level = Self.level(sample); if kind == "microphone" { micLevel = level } else { systemLevel = level }
        }
        publishStatus()
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
