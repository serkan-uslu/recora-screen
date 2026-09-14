import AppKit
import AVFoundation

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
