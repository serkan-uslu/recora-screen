import AppKit
import CoreMedia

@main struct CaptureCheck {
    static func occupyMainRunLoop() { Thread.sleep(forTimeInterval: 0.35) }
    @MainActor static func main() async {
        _ = NSApplication.shared
        let rectangle = CGRect(x: 100, y: 100, width: 800, height: 600), content = CGRect(x: 0.05, y: 0.1, width: 0.9, height: 0.8)
        let outside = CGPoint(x: 1200, y: 1200), last = CGPoint(x: 0.3, y: 0.4)
        let original = FocusedWindowContext(id: 12, title: "Original tab")
        let same = FocusedWindowContext(id: 12, title: "Original tab")
        let changed = FocusedWindowContext(id: 12, title: "New tab")
        assert(typingPosition(point: outside, lastInteraction: last, lastInteractionWindow: original, captureRect: rectangle, contentRect: content, capturedWindow: 12, focusedWindow: same) == last)
        assert(typingPosition(point: outside, lastInteraction: last, lastInteractionWindow: original, captureRect: rectangle, contentRect: content, capturedWindow: 12, focusedWindow: changed) == nil)
        assert(typingPosition(point: outside, lastInteraction: nil, lastInteractionWindow: nil, captureRect: rectangle, contentRect: content, capturedWindow: 12, focusedWindow: same) == CGPoint(x: 0.5, y: 0.5))
        assert(typingPosition(point: outside, lastInteraction: last, lastInteractionWindow: original, captureRect: rectangle, contentRect: content, capturedWindow: 12, focusedWindow: FocusedWindowContext(id: 13, title: "Other window")) == nil)
        assert(typingPosition(point: outside, lastInteraction: nil, lastInteractionWindow: nil, captureRect: rectangle, contentRect: content, capturedWindow: nil, focusedWindow: same) == nil)
        assert(CaptureInputMonitor.activity(for: .leftMouseDown) == "click")
        assert(CaptureInputMonitor.activity(for: .leftMouseUp) == nil)
        assert(CaptureInputMonitor.activity(for: .leftMouseDragged) == "drag")
        assert(CaptureInputMonitor.activity(for: .keyDown) == "typing")
        assert(CaptureInputMonitor.activity(for: .flagsChanged) == nil)

        let lock = NSLock()
        var samples: [CaptureInputMonitor.Sample] = [], monitorState = ""
        let monitor = CaptureInputMonitor(receive: { sample in lock.lock(); samples.append(sample); lock.unlock() }, state: { value, _ in lock.lock(); monitorState = value; lock.unlock() })
        await monitor.start()
        // Deliberately occupy the main run loop, as native menu tracking does. Input must continue.
        occupyMainRunLoop()
        await monitor.stop()
        let (recorded, state) = lock.withLock { (samples, monitorState) }
        assert(recorded.count >= 7, "Pointer timer stalled with the main run loop: \(recorded.count)")
        assert(zip(recorded, recorded.dropFirst()).allSatisfy { $0.hostTime <= $1.hostTime })
        assert(["active", "unavailable", "failed"].contains(state), "Monitor status was not reported")
        let stoppedCount = recorded.count
        try? await Task.sleep(nanoseconds: 80_000_000)
        let afterStop = lock.withLock { samples.count }
        assert(afterStop == stoppedCount, "Input monitor continued after stopping")

        let capture = CaptureEngine.shared
        await withCheckedContinuation { ready in
            capture.queue.async { ready.resume(); Thread.sleep(forTimeInterval: 0.3) }
        }
        let start = DispatchTime.now().uptimeNanoseconds
        for _ in 0..<1000 { assert(capture.status()["active"] as? Bool == false) }
        let duration = Double(DispatchTime.now().uptimeNanoseconds - start) / 1_000_000
        assert(duration < 50, "Status waited on the media/disk queue: \(duration)ms")
        print("Capture checks passed: \(recorded.count) off-main pointer samples, input state \(state), stopped monitor, focused-window typing, activity classification; 1,000 status reads during blocked capture queue: \(String(format: "%.2f", duration))ms. No permission changes or screen/audio recording.")
    }
}
