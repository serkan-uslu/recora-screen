import AppKit

let directory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
func render(_ size: Int, _ name: String) throws {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    let s = CGFloat(size) / 1024
    let transform = AffineTransform(scale: s)
    (transform as NSAffineTransform).concat()
    NSColor(calibratedRed: 0.341, green: 0.843, blue: 0.627, alpha: 1).setFill()
    NSBezierPath(roundedRect: NSRect(x: 45, y: 45, width: 934, height: 934), xRadius: 210, yRadius: 210).fill()
    NSColor(calibratedRed: 0.09, green: 0.129, blue: 0.114, alpha: 1).setStroke()
    let frame = NSBezierPath(roundedRect: NSRect(x: 209, y: 284, width: 606, height: 470), xRadius: 70, yRadius: 70)
    frame.lineWidth = 42; frame.stroke()
    let foot = NSBezierPath(); foot.move(to: NSPoint(x: 384, y: 211)); foot.line(to: NSPoint(x: 640, y: 211)); foot.lineWidth = 40; foot.lineCapStyle = .round; foot.stroke()
    NSColor(calibratedRed: 0.09, green: 0.129, blue: 0.114, alpha: 1).setFill()
    NSBezierPath(ovalIn: NSRect(x: 409, y: 411, width: 206, height: 206)).fill()
    NSGraphicsContext.restoreGraphicsState()
    try rep.representation(using: .png, properties: [:])!.write(to: directory.appendingPathComponent(name))
}
try render(32, "32x32.png")
try render(128, "128x128.png")
try render(256, "128x128@2x.png")
try render(512, "icon.png")
let iconset = directory.appendingPathComponent("icon.iconset")
try FileManager.default.createDirectory(at: iconset, withIntermediateDirectories: true)
for size in [16, 32, 128, 256, 512] {
    try render(size, "icon.iconset/icon_\(size)x\(size).png")
    try render(size * 2, "icon.iconset/icon_\(size)x\(size)@2x.png")
}
