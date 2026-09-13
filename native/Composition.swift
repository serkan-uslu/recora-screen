import AppKit
import AVFoundation
import CoreImage
import CoreText

final class RenderInstruction: NSObject, AVVideoCompositionInstructionProtocol, @unchecked Sendable {
    let timeRange: CMTimeRange
    let enablePostProcessing = true
    let containsTweening = true
    let requiredSourceTrackIDs: [NSValue]?
    let passthroughTrackID: CMPersistentTrackID = kCMPersistentTrackID_Invalid
    let project: Project
    let screenID: CMPersistentTrackID
    let cameraID: CMPersistentTrackID?
    let cursor: [CursorEvent]
    let images: [String: CIImage]
    let directory: String
    let transforms: [CMPersistentTrackID: CGAffineTransform]
    init(project: Project, duration: CMTime, screenID: CMPersistentTrackID, cameraID: CMPersistentTrackID?, cursor: [CursorEvent], directory: String, images: [String: CIImage], transforms: [CMPersistentTrackID: CGAffineTransform]) {
        self.project = project; self.screenID = screenID; self.cameraID = cameraID; self.cursor = cursor; self.directory = directory; self.images = images; self.transforms = transforms
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
    private var cancelled = false
    func renderContextChanged(_ newRenderContext: AVVideoCompositionRenderContext) {}
    func cancelAllPendingVideoCompositionRequests() { queue.sync { cancelled = true }; queue.async { self.cancelled = false } }
    func startRequest(_ request: AVAsynchronousVideoCompositionRequest) {
        queue.async {
            guard !self.cancelled else { request.finishCancelledRequest(); return }
            guard let instruction = request.videoCompositionInstruction as? RenderInstruction,
                  let buffer = request.renderContext.newPixelBuffer() else { request.finish(with: NativeFailure("Unable to allocate video frame.")); return }
            let bounds = CGRect(origin: .zero, size: request.renderContext.size)
            let t = sourceTime(instruction.project.edits.segments, milliseconds(request.compositionTime))
            let output = self.frame(instruction, request: request, sourceMs: t, bounds: bounds)
            self.context.render(output, to: buffer, bounds: bounds, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
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
        var alignment: CTTextAlignment = background == nil ? .left : .center
        let paragraph = withUnsafePointer(to: &alignment) { pointer in
            var setting = CTParagraphStyleSetting(spec: .alignment, valueSize: MemoryLayout<CTTextAlignment>.size, value: pointer)
            return CTParagraphStyleCreate(&setting, 1)
        }
        let attributes: [NSAttributedString.Key: Any] = [NSAttributedString.Key(kCTFontAttributeName as String): CTFontCreateUIFontForLanguage(.emphasizedSystem, fontSize, nil)!, NSAttributedString.Key(kCTForegroundColorAttributeName as String): color(foreground).cgColor, NSAttributedString.Key(kCTParagraphStyleAttributeName as String): paragraph]
        let attributed = NSAttributedString(string: text, attributes: attributes)
        let framesetter = CTFramesetterCreateWithAttributedString(attributed)
        let textWidth = max(1, width - 24)
        let measured = CTFramesetterSuggestFrameSizeWithConstraints(framesetter, CFRange(), nil, CGSize(width: textWidth, height: 10000), nil)
        let height = min(4000, ceil(measured.height) + 26)
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
        let clear = CIImage(color: .clear).cropped(to: bounds)
        var screen = CIImage(color: CIColor(red: 0.04, green: 0.05, blue: 0.07)).cropped(to: bounds)
        if let buffer = request.sourceFrame(byTrackID: instruction.screenID) { screen = fitted(CIImage(cvPixelBuffer: buffer).transformed(by: instruction.transforms[instruction.screenID] ?? .identity), to: bounds).composited(over: screen) }
        if edits.cursor.visible, let event = cursorAt(instruction.cursor, t, smooth: edits.cursor.smooth), event.x >= 0, event.x <= 1, event.y >= 0, event.y <= 1 {
            let p = CGPoint(x: event.x * w, y: (1 - event.y) * h)
            if edits.cursor.highlight && event.click == true {
                let radius = 22.0 * w / 1920
                let ring = CIImage(color: CIColor(red: 0.43, green: 0.62, blue: 1, alpha: 0.42)).cropped(to: CGRect(x: p.x - radius, y: p.y - radius, width: radius * 2, height: radius * 2))
                let m = mask(CGRect(x: p.x - radius, y: p.y - radius, width: radius * 2, height: radius * 2), circle: true)
                screen = ring.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: screen, kCIInputMaskImageKey: m])
            }
            let scale = max(0.3, min(5, edits.cursor.size)) * w / 1920
            screen = arrow.transformed(by: CGAffineTransform(scaleX: scale, y: scale)).transformed(by: CGAffineTransform(translationX: p.x - 3 * scale, y: p.y - 46 * scale)).composited(over: screen)
        }
        if let zoom = edits.zooms.last(where: { t >= $0.startMs && t < $0.endMs }) {
            let edge = min(350, max(1, (zoom.endMs - zoom.startMs) / 2))
            let ramp = max(0, min(1, min((t - zoom.startMs) / edge, (zoom.endMs - t) / edge)))
            let eased = ramp * ramp * (3 - 2 * ramp), scale = 1 + (max(1, min(5, zoom.scale)) - 1) * eased
            let tx = min(0, max(w * (1 - scale), w / 2 - zoom.x * w * scale))
            let ty = min(0, max(h * (1 - scale), h / 2 - (1 - zoom.y) * h * scale))
            screen = screen.transformed(by: CGAffineTransform(scaleX: scale, y: scale)).transformed(by: CGAffineTransform(translationX: tx, y: ty)).cropped(to: bounds)
        }
        let camera = edits.camera
        if camera.visible && !camera.hiddenRanges.contains(where: { $0.contains(t) }) && (project.source?.cameraActiveRanges?.contains(where: { $0.contains(t) }) ?? true), let id = instruction.cameraID, let buffer = request.sourceFrame(byTrackID: id) {
            let size = max(16, min(min(w, h), camera.size * w))
            let rect = CGRect(x: max(0, min(w - size, camera.x * w)), y: h - max(0, min(h - size, camera.y * h)) - size, width: size, height: size)
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
                let offset = overlay.animation == "slide" ? 24 * (1 - ramp) : 0
                screen = image.transformed(by: CGAffineTransform(translationX: overlay.x * w, y: h - overlay.y * h - image.extent.height - offset)).composited(over: screen)
            }
        }
        if edits.captions.enabled, let caption = project.transcript.first(where: { t >= $0.startMs && t < $0.endMs }), let image = textImage(caption.text, fontSize: edits.captions.fontSize * w / 1920, width: w * 0.8, foreground: edits.captions.color, background: edits.captions.background) {
            screen = image.transformed(by: CGAffineTransform(translationX: (w - image.extent.width) / 2, y: h * 0.055)).composited(over: screen)
        }
        return screen.cropped(to: bounds)
    }
}

struct BuiltComposition { let composition: AVMutableComposition; let video: AVMutableVideoComposition; let audio: AVMutableAudioMix }
func makeComposition(_ project: Project, directory: String, width: Int? = nil, height: Int? = nil) async throws -> BuiltComposition {
    guard let source = project.source, source.durationMs > 0, !project.edits.segments.isEmpty else { throw NativeFailure("Project has no recorded timeline.", code: "empty_project") }
    guard project.schemaVersion == 1, project.edits.segments.count <= 10000, project.edits.segments.allSatisfy({ $0.startMs.isFinite && $0.endMs.isFinite && $0.startMs >= 0 && $0.endMs > $0.startMs && $0.endMs <= source.durationMs + 1 }) else { throw NativeFailure("Invalid timeline ranges.", code: "invalid_project") }
    let composition = AVMutableComposition()
    var transforms: [CMPersistentTrackID: CGAffineTransform] = [:]
    var videoIDs: [String: CMPersistentTrackID] = [:], audioParameters: [AVMutableAudioMixInputParameters] = []
    for (kind, path, type, volume) in [("screen", Optional(source.screen), AVMediaType.video, 1.0), ("camera", source.camera, .video, 1.0), ("microphone", source.microphone, .audio, project.edits.audio.microphoneVolume), ("systemAudio", source.systemAudio, .audio, project.edits.audio.systemVolume)] {
        try Task.checkCancellation()
        guard let path else { continue }
        let asset = AVURLAsset(url: try projectURL(directory, path))
        guard let input = try await asset.loadTracks(withMediaType: type).first else { if kind == "screen" { throw NativeFailure("Screen video is missing.") }; continue }
        guard let output = composition.addMutableTrack(withMediaType: type, preferredTrackID: kCMPersistentTrackID_Invalid) else { throw NativeFailure("Could not create media track.") }
        let available = try await input.load(.timeRange)
        var position = CMTime.zero
        for range in project.edits.segments {
            try Task.checkCancellation()
            let requested = CMTimeRange(start: mediaTime(range.startMs), end: mediaTime(range.endMs))
            let intersection = CMTimeRangeGetIntersection(requested, otherRange: available)
            if intersection.isValid && intersection.duration > .zero {
                try output.insertTimeRange(intersection, of: input, at: position + intersection.start - requested.start)
            }
            position = position + requested.duration
        }
        if type == .video { videoIDs[kind] = output.trackID; transforms[output.trackID] = try await input.load(.preferredTransform) }
        else { let p = AVMutableAudioMixInputParameters(track: output); p.setVolume(Float(max(0, min(2, volume))), at: .zero); audioParameters.append(p) }
    }
    guard let screenID = videoIDs["screen"] else { throw NativeFailure("Screen track unavailable.") }
    let duration = mediaTime(timelineDuration(project.edits.segments))
    var cursor: [CursorEvent] = []
    if let path = source.cursor, let data = try? Data(contentsOf: projectURL(directory, path)) { cursor = readCursor(data) }
    var images: [String: CIImage] = [:]
    for asset in project.assets where asset.kind == "image" { images[asset.id] = CIImage(contentsOf: try projectURL(directory, asset.path), options: [.applyOrientationProperty: true]) }
    let video = AVMutableVideoComposition(); video.customVideoCompositorClass = ScreenrecCompositor.self
    let w = width ?? source.width, h = height ?? source.height
    guard w >= 64, h >= 64, w <= 7680, h <= 4320, w % 2 == 0, h % 2 == 0 else { throw NativeFailure("Output dimensions must be even and within 64–7680 × 64–4320.", code: "invalid_params") }
    video.renderSize = CGSize(width: w, height: h); video.frameDuration = CMTime(value: 1, timescale: 30)
    video.colorPrimaries = AVVideoColorPrimaries_ITU_R_709_2; video.colorTransferFunction = AVVideoTransferFunction_ITU_R_709_2; video.colorYCbCrMatrix = AVVideoYCbCrMatrix_ITU_R_709_2
    video.instructions = [RenderInstruction(project: project, duration: duration, screenID: screenID, cameraID: videoIDs["camera"], cursor: cursor, directory: directory, images: images, transforms: transforms)]
    let audio = AVMutableAudioMix(); audio.inputParameters = audioParameters
    return BuiltComposition(composition: composition, video: video, audio: audio)
}
