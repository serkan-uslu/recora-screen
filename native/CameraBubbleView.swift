import AppKit
@preconcurrency import AVFoundation

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
