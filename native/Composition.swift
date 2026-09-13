import AppKit
import AVFoundation
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
final class PreviewRenderMetrics: @unchecked Sendable {
    private let lock = NSLock()
    private var pending: (id: String, kind: String, started: Double, targetMs: Double?, inputAtMs: Double?)?
    private var samples: [[String: Any]] = []
    func begin(id: String, kind: String, started: Double, targetMs: Double? = nil, inputAtMs: Double? = nil) {
        let age = inputAtMs.map { Date().timeIntervalSince1970 * 1000 - $0 }
        let validInput = age.map { $0.isFinite && $0 >= 0 && $0 <= 60_000 } ?? false
        lock.withLock { pending = (id, kind, started, targetMs, validInput ? inputAtMs : nil) }
    }
    func finish(id: String, timeMs: Double) {
        lock.withLock {
            guard let pending, pending.id == id, pending.targetMs.map({ abs($0 - timeMs) <= 1000 / 30 + 0.01 }) ?? true else { return }
            var sample: [String: Any] = ["kind": pending.kind, "latencyMs": (ProcessInfo.processInfo.systemUptime - pending.started) * 1000, "timeMs": timeMs, "renderId": id]
            if let input = pending.inputAtMs {
                let latency = Date().timeIntervalSince1970 * 1000 - input
                if latency >= 0 && latency <= 60_000 { sample["inputLatencyMs"] = latency }
            }
            samples.append(sample)
            if samples.count > 1000 { samples.removeFirst(samples.count - 1000) }
            self.pending = nil
        }
    }
    func snapshot(reset: Bool = false) -> [String: Any] {
        lock.withLock {
            if reset { samples.removeAll(keepingCapacity: true); pending = nil }
            let latencies = samples.compactMap { $0["latencyMs"] as? Double }.sorted()
            let inputLatencies = samples.compactMap { $0["inputLatencyMs"] as? Double }.sorted()
            func p95(_ values: [Double]) -> Any { values.isEmpty ? NSNull() : values[min(values.count - 1, Int(ceil(Double(values.count) * 0.95)) - 1)] }
            return ["samples": samples, "count": samples.count, "p95Ms": p95(latencies), "inputCount": inputLatencies.count, "inputP95Ms": p95(inputLatencies), "pending": pending != nil]
        }
    }
}

final class RenderInstruction: NSObject, AVVideoCompositionInstructionProtocol, @unchecked Sendable {
    let timeRange: CMTimeRange
    let enablePostProcessing = true
    let containsTweening = true
    let requiredSourceTrackIDs: [NSValue]?
    let passthroughTrackID: CMPersistentTrackID = kCMPersistentTrackID_Invalid
    let renderID = UUID().uuidString
    var previewMetrics: PreviewRenderMetrics?
    let project: Project
    let screenID: CMPersistentTrackID
    let cameraID: CMPersistentTrackID?
    let cursor: [CursorEvent]
    let images: [String: CIImage]
    let directory: String
    let transforms: [CMPersistentTrackID: CGAffineTransform]
    let focusPaths: [String: [CursorEvent]]
    let interactions: [CursorEvent]
    let cameraRuns: [CameraRun]
    init(project: Project, duration: CMTime, screenID: CMPersistentTrackID, cameraID: CMPersistentTrackID?, cursor: [CursorEvent], directory: String, images: [String: CIImage], transforms: [CMPersistentTrackID: CGAffineTransform], previous: RenderInstruction? = nil) {
        let renderCursor = previous?.cursor ?? cursor.filter { $0.kind != "typing" }
        self.project = project; self.screenID = screenID; self.cameraID = cameraID; self.cursor = renderCursor; self.directory = directory; self.images = images; self.transforms = transforms
        self.interactions = cursor; self.cameraRuns = cameraOutputRuns(project)
        self.focusPaths = Dictionary(project.edits.zooms.map { zoom in
            let unchanged = previous?.project.edits.zooms.first(where: { $0.id == zoom.id }).map { (try? JSONEncoder().encode($0)) == (try? JSONEncoder().encode(zoom)) } ?? false
            return (zoom.id, unchanged ? (previous?.focusPaths[zoom.id] ?? []) : zoomFocusPath(zoom, cursor: renderCursor, interactions: cursor))
        }, uniquingKeysWith: { _, last in last })
        timeRange = CMTimeRange(start: .zero, duration: duration)
        requiredSourceTrackIDs = ([screenID] + (cameraID.map { [$0] } ?? [])).map { NSNumber(value: $0) }
    }
}

final class ScreenrecCompositor: NSObject, AVVideoCompositing {
    var sourcePixelBufferAttributes: [String: any Sendable]? { [kCVPixelBufferPixelFormatTypeKey as String: [kCVPixelFormatType_32BGRA, kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange, kCVPixelFormatType_420YpCbCr8BiPlanarFullRange]] }
    var requiredPixelBufferAttributesForRenderContext: [String: any Sendable] { [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA, kCVPixelBufferMetalCompatibilityKey as String: true] }
    let queue = DispatchQueue(label: "screenrec.compositor", qos: .userInitiated)
    let context = CIContext(options: [.cacheIntermediates: false, .workingColorSpace: CGColorSpace(name: CGColorSpace.sRGB)!])
    private var textCache: [String: CIImage] = [:]
    private var maskCache: [String: CIImage] = [:]
    private var backgroundCache: [String: CIImage] = [:]
    private let cancellationLock = NSLock()
    private var cancellationGeneration = 0
    func renderContextChanged(_ newRenderContext: AVVideoCompositionRenderContext) {}
    func cancelAllPendingVideoCompositionRequests() { cancellationLock.withLock { cancellationGeneration += 1 } }
    func startRequest(_ request: AVAsynchronousVideoCompositionRequest) {
        let generation = cancellationLock.withLock { cancellationGeneration }
        queue.async {
            guard generation == self.cancellationLock.withLock({ self.cancellationGeneration }) else { request.finishCancelledRequest(); return }
            guard let instruction = request.videoCompositionInstruction as? RenderInstruction,
                  let buffer = request.renderContext.newPixelBuffer() else { request.finish(with: NativeFailure("Unable to allocate video frame.")); return }
            let bounds = CGRect(origin: .zero, size: request.renderContext.size)
            let t = sourceTime(instruction.project.edits.segments, milliseconds(request.compositionTime))
            let output = self.frame(instruction, request: request, sourceMs: t, bounds: bounds)
            self.context.render(output, to: buffer, bounds: bounds, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
            instruction.previewMetrics?.finish(id: instruction.renderID, timeMs: milliseconds(request.compositionTime))
            request.finish(withComposedVideoFrame: buffer)
        }
    }
    private func fitted(_ image: CIImage, to rect: CGRect, fill: Bool = false) -> CIImage {
        guard image.extent.width > 0, image.extent.height > 0 else { return image }
        let scale = fill ? max(rect.width / image.extent.width, rect.height / image.extent.height) : min(rect.width / image.extent.width, rect.height / image.extent.height)
        let width = image.extent.width * scale, height = image.extent.height * scale
        return image.transformed(by: CGAffineTransform(translationX: -image.extent.minX, y: -image.extent.minY)).transformed(by: CGAffineTransform(scaleX: scale, y: scale)).transformed(by: CGAffineTransform(translationX: rect.midX - width / 2, y: rect.midY - height / 2))
    }
    private func textImage(_ text: String, fontSize: CGFloat, width: CGFloat, foreground: String, background: String? = nil) -> CIImage? {
        guard !text.isEmpty, width > 0 else { return nil }
        let key = "\(text)|\(fontSize)|\(width)|\(foreground)|\(background ?? "")"
        if let cached = textCache[key] { return cached }
        let framesetter = textFramesetter(text, fontSize: fontSize, foreground: foreground, centered: background != nil)
        let textWidth = max(1, width - 24), height = textImageSize(framesetter, width: width).height
        guard let bitmap = CGContext(data: nil, width: max(1, Int(ceil(width))), height: max(1, Int(height)), bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return nil }
        if let background { bitmap.setFillColor(color(background, alpha: 0.88).cgColor); bitmap.addPath(CGPath(roundedRect: CGRect(x: 0, y: 0, width: width, height: height), cornerWidth: 10, cornerHeight: 10, transform: nil)); bitmap.fillPath() }
        bitmap.textMatrix = .identity
        let path = CGPath(rect: CGRect(x: 12, y: 12, width: textWidth, height: height - 24), transform: nil)
        CTFrameDraw(CTFramesetterCreateFrame(framesetter, CFRange(), path, nil), bitmap)
        guard let cg = bitmap.makeImage() else { return nil }; let result = CIImage(cgImage: cg)
        // ponytail: bounded texture cache; replace with byte-budgeted LRU if very large caption projects need it.
        if textCache.count > 256 { textCache.removeAll() }; textCache[key] = result; return result
    }
    private func mask(_ rect: CGRect, circle: Bool) -> CIImage {
        let size = max(1, Int(ceil(rect.width))), key = "\(Int(ceil(rect.width)))|\(circle)"
        if let mask = maskCache[key] { return mask.transformed(by: CGAffineTransform(translationX: rect.minX, y: rect.minY)) }
        let bitmap = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue)!
        bitmap.setFillColor(gray: 1, alpha: 1)
        let r = CGRect(x: 0, y: 0, width: size, height: size)
        if circle { bitmap.fillEllipse(in: r) } else { bitmap.addPath(CGPath(roundedRect: r, cornerWidth: CGFloat(size) * 0.09, cornerHeight: CGFloat(size) * 0.09, transform: nil)); bitmap.fillPath() }
        let mask = CIImage(cgImage: bitmap.makeImage()!)
        if maskCache.count > 16 { maskCache.removeAll() }; maskCache[key] = mask
        return mask.transformed(by: CGAffineTransform(translationX: rect.minX, y: rect.minY))
    }
    private func roundedMask(_ rect: CGRect, radius: CGFloat) -> CIImage {
        CIFilter(name: "CIRoundedRectangleGenerator", parameters: ["inputExtent": CIVector(cgRect: rect), "inputRadius": radius, "inputColor": CIColor.white])!.outputImage!.cropped(to: rect)
    }
    private func canvasBackground(_ canvas: CanvasSettings, bounds: CGRect, images: [String: CIImage]) -> CIImage {
        let key = "\(bounds)|\(canvas.background)|\(canvas.color)|\(canvas.gradientTo)|\(canvas.gradientAngle)|\(canvas.wallpaper)|\(canvas.assetId ?? "")|\(canvas.blur)"
        if let cached = backgroundCache[key] { return cached }
        func gradient(_ from: String, _ to: String, angle: Double) -> CIImage {
            let radians = angle * .pi / 180, dx = sin(radians), dy = -cos(radians)
            let span = (abs(dx) * bounds.width + abs(dy) * bounds.height) / 2
            return CIFilter(name: "CILinearGradient", parameters: ["inputPoint0": CIVector(x: bounds.midX - dx * span, y: bounds.midY + dy * span), "inputPoint1": CIVector(x: bounds.midX + dx * span, y: bounds.midY - dy * span), "inputColor0": CIColor(color: color(from))!, "inputColor1": CIColor(color: color(to))!])!.outputImage!.cropped(to: bounds)
        }
        var result = CIImage(color: CIColor(color: color(canvas.color))!).cropped(to: bounds)
        switch canvas.background {
        case "hidden": result = CIImage(color: .black).cropped(to: bounds)
        case "gradient": result = gradient(canvas.color, canvas.gradientTo, angle: canvas.gradientAngle)
        case "wallpaper":
            let palette: [String: [String]] = ["aurora": ["#071b31", "#20554f", "#9cf2ba"], "sunset": ["#291747", "#b94356", "#ffbb77"], "ocean": ["#071c36", "#145d93", "#63d7e5"], "dusk": ["#13172c", "#554176", "#bd91bf"]]
            let colors = palette[canvas.wallpaper] ?? palette["aurora"]!
            result = gradient(colors[0], colors[1], angle: 120)
            for (x, y, opacity) in [(0.15, 0.8, 0.82), (0.85, 0.15, 0.4)] {
                let glow = CIFilter(name: "CIRadialGradient", parameters: ["inputCenter": CIVector(x: bounds.width * x, y: bounds.height * y), "inputRadius0": 0, "inputRadius1": max(bounds.width, bounds.height) * 0.85, "inputColor0": CIColor(color: color(colors[2], alpha: opacity))!, "inputColor1": CIColor.clear])!.outputImage!.cropped(to: bounds)
                result = glow.composited(over: result)
            }
        case "image": if let id = canvas.assetId, let image = images[id] { result = fitted(image, to: bounds, fill: true).cropped(to: bounds) }
        default: break
        }
        if canvas.blur > 0 { result = result.clampedToExtent().applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: min(60, canvas.blur) * min(bounds.width, bounds.height) / 1080]).cropped(to: bounds) }
        result = result.composited(over: CIImage(color: .black).cropped(to: bounds))
        if backgroundCache.count >= 8 { backgroundCache.removeAll() }; backgroundCache[key] = result; return result
    }
    private func decoratedScreen(_ source: CIImage, instruction: RenderInstruction, bounds: CGRect, layout: CanvasLayout) -> CIImage {
        guard let canvas = instruction.project.edits.canvas else { return source }
        let unit = min(bounds.width, bounds.height)
        var background = canvasBackground(canvas, bounds: bounds, images: instruction.images)
        let shape = roundedMask(layout.frame, radius: max(0, min(0.1, canvas.radius)) * unit)
        if canvas.shadow > 0 {
            let shadow = CIImage(color: CIColor(red: 0, green: 0, blue: 0, alpha: min(1, canvas.shadow) * 0.65)).cropped(to: bounds).applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: CIImage(color: .clear), kCIInputMaskImageKey: shape]).applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: 24 * unit / 1080]).transformed(by: CGAffineTransform(translationX: 0, y: -12 * unit / 1080))
            background = shadow.composited(over: background)
        }
        var framed = source.transformed(by: CGAffineTransform(translationX: layout.content.minX, y: layout.content.minY))
        if layout.titleHeight > 0 {
            let bar = CGRect(x: layout.frame.minX, y: layout.content.maxY, width: layout.frame.width, height: layout.titleHeight)
            var chrome = CIImage(color: CIColor(red: 0.12, green: 0.13, blue: 0.16)).cropped(to: bar)
            if canvas.frame == "browser" {
                let radius = layout.titleHeight * 0.115
                for (index, hex) in ["#ff6058", "#ffbd2e", "#28c840"].enumerated() {
                    let dot = CGRect(x: bar.minX + layout.titleHeight * (0.36 + Double(index) * 0.4), y: bar.midY - radius, width: radius * 2, height: radius * 2)
                    chrome = CIImage(color: CIColor(color: color(hex))!).cropped(to: dot).applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: chrome, kCIInputMaskImageKey: mask(dot, circle: true)])
                }
            }
            let title = canvas.title.isEmpty ? (instruction.project.source?.title ?? instruction.project.name) : canvas.title
            if let text = textImage(title, fontSize: max(6, layout.titleHeight * 0.3), width: max(30, bar.width * 0.62), foreground: "#d9dde8") {
                chrome = text.transformed(by: CGAffineTransform(translationX: bar.minX + bar.width * 0.2, y: bar.midY - text.extent.height / 2)).composited(over: chrome).cropped(to: bar)
            }
            framed = chrome.composited(over: framed)
        }
        return framed.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: background, kCIInputMaskImageKey: shape]).cropped(to: bounds)
    }
    private lazy var arrow: CIImage = {
        let c = CGContext(data: nil, width: 36, height: 48, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        c.translateBy(x: 0, y: 48); c.scaleBy(x: 1, y: -1)
        c.move(to: CGPoint(x: 3, y: 2)); c.addLine(to: CGPoint(x: 3, y: 37)); c.addLine(to: CGPoint(x: 12, y: 29)); c.addLine(to: CGPoint(x: 19, y: 44)); c.addLine(to: CGPoint(x: 26, y: 40)); c.addLine(to: CGPoint(x: 19, y: 26)); c.addLine(to: CGPoint(x: 31, y: 26)); c.closePath()
        c.setFillColor(NSColor.black.cgColor); c.setStrokeColor(NSColor.white.cgColor); c.setLineWidth(2); c.drawPath(using: .fillStroke)
        return CIImage(cgImage: c.makeImage()!)
    }()
    private func cursorAt(_ events: [CursorEvent], _ t: Double, smooth: Bool) -> CursorEvent? {
        guard !events.isEmpty else { return nil }
        var lo = 0, hi = events.count
        while lo < hi { let mid = (lo + hi) / 2; if events[mid].tMs <= t { lo = mid + 1 } else { hi = mid } }
        let a = events[max(0, lo - 1)]
        guard t >= a.tMs, t - a.tMs < 160 else { return nil }
        guard smooth, lo < events.count, events[lo].tMs - a.tMs < 160 else { return a }
        let b = events[lo], fraction = max(0, min(1, (t - a.tMs) / max(1, b.tMs - a.tMs)))
        return CursorEvent(tMs: t, x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction, click: a.click)
    }
    private func frame(_ instruction: RenderInstruction, request: AVAsynchronousVideoCompositionRequest, sourceMs t: Double, bounds: CGRect) -> CIImage {
        let project = instruction.project, edits = project.edits, w = bounds.width, h = bounds.height
        let layout = CanvasLayout(project: project, bounds: bounds)
        let screenBounds = CGRect(origin: .zero, size: layout.content.size), sw = screenBounds.width, sh = screenBounds.height
        let clear = CIImage(color: .clear).cropped(to: bounds)
        var screen = CIImage(color: CIColor(red: 0.04, green: 0.05, blue: 0.07)).cropped(to: screenBounds)
        if let buffer = request.sourceFrame(byTrackID: instruction.screenID) { screen = fitted(CIImage(cvPixelBuffer: buffer).transformed(by: instruction.transforms[instruction.screenID] ?? .identity), to: screenBounds).composited(over: screen) }
        if edits.cursor.visible, let event = cursorAt(instruction.cursor, t, smooth: edits.cursor.smooth), event.x >= 0, event.x <= 1, event.y >= 0, event.y <= 1 {
            let p = CGPoint(x: event.x * sw, y: (1 - event.y) * sh)
            if edits.cursor.highlight && event.click == true {
                let radius = 22.0 * sw / 1920
                let ring = CIImage(color: CIColor(red: 0.43, green: 0.62, blue: 1, alpha: 0.42)).cropped(to: CGRect(x: p.x - radius, y: p.y - radius, width: radius * 2, height: radius * 2))
                let m = mask(CGRect(x: p.x - radius, y: p.y - radius, width: radius * 2, height: radius * 2), circle: true)
                screen = ring.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: screen, kCIInputMaskImageKey: m])
            }
            let scale = max(0.3, min(5, edits.cursor.size)) * sw / 1920
            screen = arrow.transformed(by: CGAffineTransform(scaleX: scale, y: scale)).transformed(by: CGAffineTransform(translationX: p.x - 3 * scale, y: p.y - 46 * scale)).composited(over: screen)
        }
        if let zoom = edits.zooms.last(where: { t >= $0.startMs && t < $0.endMs }) {
            let scale = 1 + (max(1, min(5, zoom.scale)) - 1) * zoomAmount(zoom, at: t)
            let focus = zoomFocus(zoom, path: instruction.focusPaths[zoom.id] ?? [], at: t)
            let tx = min(0, max(sw * (1 - scale), sw / 2 - focus.x * sw * scale))
            let ty = min(0, max(sh * (1 - scale), sh / 2 - (1 - focus.y) * sh * scale))
            screen = screen.transformed(by: CGAffineTransform(scaleX: scale, y: scale)).transformed(by: CGAffineTransform(translationX: tx, y: ty)).cropped(to: screenBounds)
        }
        screen = decoratedScreen(screen, instruction: instruction, bounds: bounds, layout: layout)
        let camera = cameraVisual(instruction.cameraRuns, at: milliseconds(request.compositionTime), fallback: CameraVisual(edits.camera))
        if cameraVisible(project, at: t), let id = instruction.cameraID, let buffer = request.sourceFrame(byTrackID: id) {
            let rect = cameraRect(camera, bounds: bounds)
            let m = mask(rect, circle: camera.shape == "circle")
            if camera.shadow {
                let shadow = CIImage(color: CIColor(red: 0, green: 0, blue: 0, alpha: 0.4)).cropped(to: bounds).applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: clear, kCIInputMaskImageKey: m]).applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: 10 * w / 1920]).transformed(by: CGAffineTransform(translationX: 0, y: -5 * w / 1920))
                screen = shadow.composited(over: screen)
            }
            screen = fitted(CIImage(cvPixelBuffer: buffer).transformed(by: instruction.transforms[id] ?? .identity), to: rect, fill: true).cropped(to: rect).applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: screen, kCIInputMaskImageKey: m])
        }
        for overlay in edits.overlays where t >= overlay.startMs && t < overlay.endMs {
            var image: CIImage?
            let width = max(24, min(w, overlay.width * w))
            if overlay.kind == "image", let id = overlay.assetId, let source = instruction.images[id] {
                image = fitted(source, to: CGRect(x: 0, y: 0, width: width, height: width * source.extent.height / max(1, source.extent.width)))
            } else { image = textImage(overlay.text ?? "", fontSize: overlay.fontSize * w / 1920, width: width, foreground: overlay.color) }
            if var image {
                let ramp = max(0, min(1, min((t - overlay.startMs) / 220, (overlay.endMs - t) / 220)))
                if overlay.animation != "none" { image = image.applyingFilter("CIColorMatrix", parameters: ["inputAVector": CIVector(x: 0, y: 0, z: 0, w: ramp)]) }
                let rect = overlayRect(overlay, sourceMs: t, bounds: bounds, images: instruction.images, measuredSize: image.extent.size)
                screen = image.transformed(by: CGAffineTransform(translationX: rect.minX, y: rect.minY)).composited(over: screen)
            }
        }
        if edits.captions.enabled, let caption = project.transcript.first(where: { t >= $0.startMs && t < $0.endMs }), let image = textImage(caption.text, fontSize: edits.captions.fontSize * w / 1920, width: w * 0.8, foreground: edits.captions.color, background: edits.captions.background) {
            screen = image.transformed(by: CGAffineTransform(translationX: (w - image.extent.width) / 2, y: h * 0.055)).composited(over: screen)
        }
        return screen.cropped(to: bounds)
    }
}

struct BuiltComposition {
    let composition: AVMutableComposition; let video: AVMutableVideoComposition; let audio: AVMutableAudioMix
    let audioKinds: [CMPersistentTrackID: String]
    var instruction: RenderInstruction { video.instructions[0] as! RenderInstruction }
}
func mediaStructure(_ project: Project, directory: String) throws -> Data {
    // UI properties never belong in this identity: they only replace render instructions.
    let encoder = JSONEncoder(); encoder.outputFormatting = .sortedKeys
    struct Structure: Encodable { let id: String; let directory: String; let source: RecordingSource?; let segments: [MediaRange] }
    return try encoder.encode(Structure(id: project.id, directory: directory, source: project.source, segments: project.edits.segments))
}
func videoComposition(_ project: Project, instruction: RenderInstruction, width: Int? = nil, height: Int? = nil) throws -> AVMutableVideoComposition {
    let dimensions = renderDimensions(project), w = width ?? Int(dimensions.width), h = height ?? Int(dimensions.height)
    guard w >= 16, h >= 16, w <= 7680, h <= 4320, w % 2 == 0, h % 2 == 0 else { throw NativeFailure("Output dimensions must be even and within 16–7680 × 16–4320.", code: "invalid_params") }
    let video = AVMutableVideoComposition(); video.customVideoCompositorClass = ScreenrecCompositor.self
    video.renderSize = CGSize(width: w, height: h); video.frameDuration = CMTime(value: 1, timescale: 30)
    video.colorPrimaries = AVVideoColorPrimaries_ITU_R_709_2; video.colorTransferFunction = AVVideoTransferFunction_ITU_R_709_2; video.colorYCbCrMatrix = AVVideoYCbCrMatrix_ITU_R_709_2
    video.instructions = [instruction]; return video
}
func updateComposition(_ project: Project, previous: BuiltComposition) async throws -> BuiltComposition {
    try validateCompositionProject(project)
    let old = previous.instruction
    var images: [String: CIImage] = [:]
    for asset in project.assets where asset.kind == "image" {
        if old.project.assets.contains(where: { $0.id == asset.id && $0.path == asset.path }) { images[asset.id] = old.images[asset.id] }
        else { images[asset.id] = CIImage(contentsOf: try projectURL(old.directory, asset.path), options: [.applyOrientationProperty: true]) }
    }
    let instruction = RenderInstruction(project: project, duration: old.timeRange.duration, screenID: old.screenID, cameraID: old.cameraID, cursor: old.interactions, directory: old.directory, images: images, transforms: old.transforms, previous: old)
    let video = try videoComposition(project, instruction: instruction)
    let audio = AVMutableAudioMix()
    audio.inputParameters = previous.audioKinds.map { id, kind in
        let parameter = AVMutableAudioMixInputParameters(); parameter.trackID = id
        parameter.setVolume(Float(max(0, min(2, kind == "microphone" ? project.edits.audio.microphoneVolume : project.edits.audio.systemVolume))), at: .zero)
        parameter.audioTimePitchAlgorithm = .spectral; return parameter
    }
    return BuiltComposition(composition: previous.composition, video: video, audio: audio, audioKinds: previous.audioKinds)
}

func validateCompositionProject(_ project: Project) throws {
    guard let source = project.source, source.durationMs > 0, !project.edits.segments.isEmpty else { throw NativeFailure("Project has no recorded timeline.", code: "empty_project") }
    guard project.schemaVersion == 1 || project.schemaVersion == 2 else { throw NativeFailure("This project format is not supported by this version.", code: "unsupported_version") }
    guard project.edits.segments.count <= 10000, project.edits.segments.allSatisfy({ $0.startMs.isFinite && $0.endMs.isFinite && $0.startMs >= 0 && $0.endMs > $0.startMs && $0.endMs <= source.durationMs + 1 && $0.rate.isFinite && $0.rate >= 0.25 && $0.rate <= 8 }) else { throw NativeFailure("Invalid timeline ranges or playback speed.", code: "invalid_project") }
}
func makeComposition(_ project: Project, directory: String, width: Int? = nil, height: Int? = nil) async throws -> BuiltComposition {
    try validateCompositionProject(project)
    let source = project.source!
    let composition = AVMutableComposition()
    var transforms: [CMPersistentTrackID: CGAffineTransform] = [:]
    var videoIDs: [String: CMPersistentTrackID] = [:], audioParameters: [AVMutableAudioMixInputParameters] = []
    var audioKinds: [CMPersistentTrackID: String] = [:]
    for (kind, path, type, volume) in [("screen", Optional(source.screen), AVMediaType.video, 1.0), ("camera", source.camera, .video, 1.0), ("microphone", source.microphone, .audio, project.edits.audio.microphoneVolume), ("systemAudio", source.systemAudio, .audio, project.edits.audio.systemVolume)] {
        try Task.checkCancellation()
        guard let path else { continue }
        let asset = AVURLAsset(url: try projectURL(directory, path))
        guard let input = try await asset.loadTracks(withMediaType: type).first else { if kind == "screen" { throw NativeFailure("Screen video is missing.") }; continue }
        var outputs: [Double: AVMutableCompositionTrack] = [:]
        let available = try await input.load(.timeRange)
        var position = CMTime.zero
        for range in project.edits.segments {
            try Task.checkCancellation()
            let requested = CMTimeRange(start: mediaTime(range.startMs), end: mediaTime(range.endMs))
            let intersection = CMTimeRangeGetIntersection(requested, otherRange: available)
            if intersection.isValid && intersection.duration > .zero {
                // AVFoundation may silence/truncate audio when a pitch processor changes rate
                // on one track. Reuse one audio track per rate; gaps and cuts retain absolute timing.
                let key = type == .audio ? range.rate : 0
                let output: AVMutableCompositionTrack
                if let existing = outputs[key] { output = existing }
                else { guard let created = composition.addMutableTrack(withMediaType: type, preferredTrackID: kCMPersistentTrackID_Invalid) else { throw NativeFailure("Could not create media track.") }; outputs[key] = created; output = created }
                let start = position + CMTimeMultiplyByFloat64(intersection.start - requested.start, multiplier: 1 / range.rate)
                try output.insertTimeRange(intersection, of: input, at: start)
                if range.rate != 1 { output.scaleTimeRange(CMTimeRange(start: start, duration: intersection.duration), toDuration: CMTimeMultiplyByFloat64(intersection.duration, multiplier: 1 / range.rate)) }
            }
            position = position + mediaTime(range.outputDuration)
        }
        if type == .video, let output = outputs[0] { videoIDs[kind] = output.trackID; transforms[output.trackID] = try await input.load(.preferredTransform) }
        else { for output in outputs.values { let p = AVMutableAudioMixInputParameters(track: output); p.setVolume(Float(max(0, min(2, volume))), at: .zero); p.audioTimePitchAlgorithm = .spectral; audioParameters.append(p); audioKinds[output.trackID] = kind } }
    }
    guard let screenID = videoIDs["screen"] else { throw NativeFailure("Screen track unavailable.") }
    let duration = mediaTime(timelineDuration(project.edits.segments))
    var cursor: [CursorEvent] = []
    if let path = source.cursor, let data = try? Data(contentsOf: projectURL(directory, path)) { cursor = readCursor(data) }
    var images: [String: CIImage] = [:]
    for asset in project.assets where asset.kind == "image" { images[asset.id] = CIImage(contentsOf: try projectURL(directory, asset.path), options: [.applyOrientationProperty: true]) }
    let instruction = RenderInstruction(project: project, duration: duration, screenID: screenID, cameraID: videoIDs["camera"], cursor: cursor, directory: directory, images: images, transforms: transforms)
    let video = try videoComposition(project, instruction: instruction, width: width, height: height)
    let audio = AVMutableAudioMix(); audio.inputParameters = audioParameters
    return BuiltComposition(composition: composition, video: video, audio: audio, audioKinds: audioKinds)
}
