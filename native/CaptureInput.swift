import AppKit
import CoreMedia

func cursorPosition(_ point: CGPoint, captureRect: CGRect, normalizedContentRect: CGRect) -> CGPoint? {
    guard captureRect.width > 0, captureRect.height > 0 else { return nil }
    let x = (point.x - captureRect.minX) / captureRect.width, y = (point.y - captureRect.minY) / captureRect.height
    guard x >= 0, x <= 1, y >= 0, y <= 1 else { return nil }
    let result = CGPoint(x: normalizedContentRect.minX + x * normalizedContentRect.width, y: normalizedContentRect.minY + y * normalizedContentRect.height)
    return result.x >= 0 && result.x <= 1 && result.y >= 0 && result.y <= 1 ? result : nil
}

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
