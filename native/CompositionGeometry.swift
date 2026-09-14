import AppKit
import CoreImage
import CoreText

struct CanvasLayout {
    let content: CGRect; let frame: CGRect; let titleHeight: CGFloat
    init(project: Project, bounds: CGRect) {
        guard let canvas = project.edits.canvas else { content = bounds; frame = bounds; titleHeight = 0; return }
        let unit = min(bounds.width, bounds.height), inset = unit * max(0, min(0.2, canvas.padding))
        let available = bounds.insetBy(dx: inset, dy: inset)
        titleHeight = canvas.frame == "none" ? 0 : min(available.height * 0.1, unit / 1080 * (canvas.frame == "browser" ? 42 : 28))
        let ratio = CGFloat(project.source?.width ?? 1920) / CGFloat(max(1, project.source?.height ?? 1080))
        let width = min(available.width, max(1, available.height - titleHeight) * ratio), height = width / ratio
        frame = CGRect(x: bounds.midX - width / 2, y: bounds.midY - (height + titleHeight) / 2, width: width, height: height + titleHeight)
        content = CGRect(x: frame.minX, y: frame.minY, width: width, height: height)
    }
}

// Both the compositor and editing handles use these pixel-space layouts.
struct CameraVisual: Equatable {
    var shape: String; var x: Double; var y: Double; var size: Double; var shadow: Bool
    init(_ camera: CameraSettings) { shape = camera.shape; x = camera.x; y = camera.y; size = camera.size; shadow = camera.shadow }
    init(_ layout: CameraLayout) { shape = layout.shape; x = layout.x; y = layout.y; size = layout.size; shadow = layout.shadow }
}
struct CameraRun { var startMs: Double; var endMs: Double; var visual: CameraVisual }
func cameraOutputRuns(_ project: Project) -> [CameraRun] {
    let base = CameraVisual(project.edits.camera), layouts = project.edits.camera.layouts ?? []
    var result: [CameraRun] = [], offset = 0.0
    for segment in project.edits.segments {
        var edges = [segment.startMs, segment.endMs]
        for layout in layouts where layout.endMs > segment.startMs && layout.startMs < segment.endMs {
            edges.append(max(segment.startMs, layout.startMs)); edges.append(min(segment.endMs, layout.endMs))
        }
        edges = Array(Set(edges)).sorted()
        for index in 0..<max(0, edges.count - 1) {
            let start = edges[index], end = edges[index + 1], middle = (start + end) / 2
            let visual = layouts.last(where: { $0.startMs <= middle && middle < $0.endMs }).map(CameraVisual.init) ?? base
            let run = CameraRun(startMs: offset + (start - segment.startMs) / segment.rate, endMs: offset + (end - segment.startMs) / segment.rate, visual: visual)
            if let last = result.last, last.visual == visual { result[result.count - 1].endMs = run.endMs } else { result.append(run) }
        }
        offset += segment.outputDuration
    }
    return result
}
func cameraVisual(_ runs: [CameraRun], at time: Double, fallback: CameraVisual) -> CameraVisual {
    guard !runs.isEmpty else { return fallback }
    var low = 0, high = runs.count
    while low < high { let middle = (low + high) / 2; if runs[middle].endMs <= time { low = middle + 1 } else { high = middle } }
    let index = min(low, runs.count - 1)
    for boundary in [index, index + 1] where boundary > 0 && boundary < runs.count {
        let a = runs[boundary - 1], b = runs[boundary]
        let half = min(150, (a.endMs - a.startMs) / 2, (b.endMs - b.startMs) / 2)
        guard half > 0, time >= b.startMs - half, time < b.startMs + half else { continue }
        let fraction = max(0, min(1, (time - b.startMs + half) / (half * 2))), blend = fraction * fraction * (3 - 2 * fraction)
        var result = fraction < 0.5 ? a.visual : b.visual
        result.x = a.visual.x + (b.visual.x - a.visual.x) * blend
        result.y = a.visual.y + (b.visual.y - a.visual.y) * blend
        result.size = a.visual.size + (b.visual.size - a.visual.size) * blend
        return result
    }
    return runs[index].visual
}
func cameraRect(_ camera: CameraVisual, bounds: CGRect) -> CGRect {
    let size = max(16, min(min(bounds.width, bounds.height), camera.size * bounds.width))
    return CGRect(x: max(0, min(bounds.width - size, camera.x * bounds.width)), y: bounds.height - max(0, min(bounds.height - size, camera.y * bounds.height)) - size, width: size, height: size)
}
func cameraVisible(_ project: Project, at time: Double) -> Bool {
    project.source?.camera != nil && project.edits.camera.visible && !project.edits.camera.hiddenRanges.contains(where: { $0.contains(time) }) && (project.source?.cameraActiveRanges?.contains(where: { $0.contains(time) }) ?? true)
}
func textFramesetter(_ text: String, fontSize: CGFloat, foreground: String, centered: Bool = false) -> CTFramesetter {
    var alignment: CTTextAlignment = centered ? .center : .left
    let paragraph = withUnsafePointer(to: &alignment) { pointer in
        var setting = CTParagraphStyleSetting(spec: .alignment, valueSize: MemoryLayout<CTTextAlignment>.size, value: pointer)
        return CTParagraphStyleCreate(&setting, 1)
    }
    let attributes: [NSAttributedString.Key: Any] = [NSAttributedString.Key(kCTFontAttributeName as String): CTFontCreateUIFontForLanguage(.emphasizedSystem, fontSize, nil)!, NSAttributedString.Key(kCTForegroundColorAttributeName as String): color(foreground).cgColor, NSAttributedString.Key(kCTParagraphStyleAttributeName as String): paragraph]
    return CTFramesetterCreateWithAttributedString(NSAttributedString(string: text, attributes: attributes))
}
func textImageSize(_ framesetter: CTFramesetter, width: CGFloat) -> CGSize {
    let measured = CTFramesetterSuggestFrameSizeWithConstraints(framesetter, CFRange(), nil, CGSize(width: max(1, width - 24), height: 10000), nil)
    return CGSize(width: max(1, ceil(width)), height: min(4000, ceil(measured.height) + 26))
}
func overlayRect(_ overlay: Overlay, sourceMs: Double, bounds: CGRect, images: [String: CIImage], measuredSize: CGSize? = nil) -> CGRect {
    let width = max(24, min(bounds.width, overlay.width * bounds.width)), size: CGSize
    if let measuredSize { size = measuredSize }
    else if overlay.kind == "image", let id = overlay.assetId, let image = images[id] { size = CGSize(width: width, height: width * image.extent.height / max(1, image.extent.width)) }
    else { size = textImageSize(textFramesetter(overlay.text ?? "", fontSize: overlay.fontSize * bounds.width / 1920, foreground: overlay.color), width: width) }
    let ramp = max(0, min(1, min((sourceMs - overlay.startMs) / 220, (overlay.endMs - sourceMs) / 220)))
    let offset = overlay.animation == "slide" ? 24 * (1 - ramp) : 0
    return CGRect(x: overlay.x * bounds.width, y: bounds.height - overlay.y * bounds.height - size.height - offset, width: size.width, height: size.height)
}

func zoomAmount(_ zoom: Zoom, at t: Double) -> Double {
    let transition = zoom.motion == "snappy" ? 230.0 : 350.0
    let edge = min(transition, max(1, (zoom.endMs - zoom.startMs) / 2))
    let ramp = max(0, min(1, min((t - zoom.startMs) / edge, (zoom.endMs - t) / edge)))
    return zoom.motion == "snappy" ? 1 - pow(1 - ramp, 3) : ramp * ramp * (3 - 2 * ramp)
}
func zoomFocusPath(_ zoom: Zoom, cursor: [CursorEvent], interactions: [CursorEvent]? = nil) -> [CursorEvent] {
    guard zoom.followCursor == true else { return [] }
    var low = 0, high = cursor.count
    while low < high { let middle = (low + high) / 2; if cursor[middle].tMs < zoom.startMs { low = middle + 1 } else { high = middle } }
    let hold = zoom.motion == "snappy" ? 450.0 : 600.0, lead = zoom.motion == "snappy" ? 100.0 : 160.0
    let activity = interactions ?? cursor
    var first = 0, last = activity.count
    while first < last { let middle = (first + last) / 2; if activity[middle].tMs < zoom.startMs { first = middle + 1 } else { last = middle } }
    var holdUntil = zoom.startMs + hold
    for event in activity[first...] {
        if event.tMs >= zoom.endMs { break }
        if event.click == true || event.kind != nil { holdUntil = max(holdUntil, event.tMs + (zoom.motion == "snappy" ? 180 : 260)); break }
    }
    let tau = zoom.motion == "snappy" ? 130.0 : 300.0
    var result = [CursorEvent(tMs: zoom.startMs, x: zoom.x, y: zoom.y, click: nil)]
    var x = zoom.x, y = zoom.y, previous = zoom.startMs, future = low
    for index in low..<cursor.count {
        let event = cursor[index]; if event.tMs >= zoom.endMs { break }
        guard event.tMs > previous else { continue }
        while future + 1 < cursor.count && cursor[future + 1].tMs <= min(zoom.endMs, event.tMs + lead) { future += 1 }
        if event.tMs >= holdUntil {
            let target = cursor[max(index, future)], alpha = 1 - exp(-min(100, event.tMs - previous) / tau)
            x += (target.x - x) * alpha; y += (target.y - y) * alpha
        }
        result.append(CursorEvent(tMs: event.tMs, x: max(0, min(1, x)), y: max(0, min(1, y)), click: nil)); previous = event.tMs
    }
    return result
}
func zoomFocus(_ zoom: Zoom, path: [CursorEvent], at t: Double) -> CGPoint {
    guard !path.isEmpty else { return CGPoint(x: zoom.x, y: zoom.y) }
    var low = 0, high = path.count
    while low < high { let middle = (low + high) / 2; if path[middle].tMs <= t { low = middle + 1 } else { high = middle } }
    let a = path[max(0, low - 1)]; guard low < path.count else { return CGPoint(x: a.x, y: a.y) }
    let b = path[low], fraction = max(0, min(1, (t - a.tMs) / max(1, b.tMs - a.tMs)))
    return CGPoint(x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction)
}

// Bounded diagnostics measure command arrival to the matching composited frame, not display scanout.
