import AppKit
import AVFoundation
import CoreImage

@main struct NativeCheck {
    @MainActor static func main() async {
        do {
            _ = NSApplication.shared
            if CommandLine.arguments.count > 1 && CommandLine.arguments[1] == "--pattern" {
                NSApp.setActivationPolicy(.accessory)
                let window = NSWindow(contentRect: CGRect(x: 100, y: 100, width: 640, height: 360), styleMask: [.titled], backing: .buffered, defer: false)
                window.title = "Screen Recorder Capture Test"; window.contentView?.wantsLayer = true; window.contentView?.layer?.backgroundColor = NSColor.systemIndigo.cgColor
                window.orderFrontRegardless()
                NSApp.run()
                return
            }
            if CommandLine.arguments.count > 1 && CommandLine.arguments[1] == "--capture-check" {
                let pattern = Process(); pattern.executableURL = URL(fileURLWithPath: CommandLine.arguments[0]); pattern.arguments = ["--pattern"]; try pattern.run()
                defer { if pattern.isRunning { pattern.terminate() } }
                try await Task.sleep(nanoseconds: 600_000_000)
                let caps = await NativeApp.shared.capabilities()
                let sources = caps["sources"] as? [[String: Any]] ?? []
                guard let selected = sources.first(where: { ($0["name"] as? String ?? "").contains("Screen Recorder Capture Test") && $0["kind"] as? String == "window" }) else { throw NativeFailure("Synthetic capture window could not be located; screen permission may be missing.") }
                let dir = FileManager.default.temporaryDirectory.appendingPathComponent("screenrec-capture-check-\(UUID().uuidString)", isDirectory: true)
                let settings = CaptureSettings(sourceId: selected["id"] as! String, sourceKind: "window", region: nil, cameraId: nil, microphoneId: "BuiltInMicrophoneDevice", systemAudio: true, cameraShape: "circle", width: 1280, height: 720, fps: 30)
                _ = try await CaptureEngine.shared.start(projectID: "capture-check", directory: dir.path, settings: settings)
                try await Task.sleep(nanoseconds: 1_500_000_000)
                _ = try CaptureEngine.shared.pause(); try await Task.sleep(nanoseconds: 300_000_000); _ = try CaptureEngine.shared.resume()
                try await Task.sleep(nanoseconds: 1_500_000_000)
                let result = try await CaptureEngine.shared.stop()
                print(String(decoding: try JSONSerialization.data(withJSONObject: result), as: UTF8.self))
                let source = try decode(RecordingSource.self, result["source"]!)
                let inspected = try await NativeApp.shared.inspectMedia(dir.appendingPathComponent(source.screen).path)
                assert(abs((inspected["durationMs"] as! Double) - source.durationMs) < 200)
                for name in [source.screen, source.microphone, source.systemAudio].compactMap({ $0 }) {
                    let asset = AVURLAsset(url: dir.appendingPathComponent(name)), duration = try await asset.load(.duration)
                    print("\(name): duration \(milliseconds(duration))ms")
                    assert(abs(milliseconds(duration) - source.durationMs) < 300)
                }
                let events = try JSONDecoder().decode([CursorEvent].self, from: Data(contentsOf: dir.appendingPathComponent(source.cursor!)))
                assert(events.allSatisfy { $0.tMs <= source.durationMs && $0.x >= 0 && $0.x <= 1 && $0.y >= 0 && $0.y <= 1 })
                print("Real capture check passed (screen, microphone, system track, pause/resume, cursor); artifacts: \(dir.path)")
                return
            }
            if CommandLine.arguments.count > 1 && CommandLine.arguments[1] == "--rpc" {
                while let line = readLine() {
                    do {
                        guard let request = try JSONSerialization.jsonObject(with: Data(line.utf8)) as? [String: Any], let method = request["method"] as? String else { continue }
                        let result = try await NativeApp.shared.command(method, request["params"] as? [String: Any] ?? [:])
                        let data = try JSONSerialization.data(withJSONObject: ["id": request["id"] ?? NSNull(), "result": result]); print(String(decoding: data, as: UTF8.self))
                    } catch { print("{\"error\":\"\(error.localizedDescription.replacingOccurrences(of: "\"", with: "'"))\"}") }
                }; return
            }
            let dir = FileManager.default.temporaryDirectory.appendingPathComponent("screenrec-native-check-\(UUID().uuidString)", isDirectory: true)
            try FileManager.default.createDirectory(at: dir.appendingPathComponent("media"), withIntermediateDirectories: true)
            let source = dir.appendingPathComponent("media/screen.mov"), camera = dir.appendingPathComponent("media/camera.mov")
            try await syntheticVideo(source, camera: false); try await syntheticVideo(camera, camera: true)
            try (wavHeader(16000 * 2 * 4) + syntheticAudio()).write(to: dir.appendingPathComponent("media/mic.wav"))
            let cursor = (0..<120).map { CursorEvent(tMs: Double($0) * 1000 / 30, x: 0.2 + Double($0) / 240, y: 0.2 + Double($0) / 600, click: $0 > 80) }
            try JSONEncoder().encode(cursor).write(to: dir.appendingPathComponent("media/cursor.json"))
            var project = Project(schemaVersion: 1, id: "test", name: "Synthetic native check", source: RecordingSource(durationMs: 4000, width: 640, height: 360, fps: 30, screen: "media/screen.mov", camera: "media/camera.mov", microphone: "media/mic.wav", systemAudio: nil, cursor: "media/cursor.json"), edits: EditState(segments: [MediaRange(startMs: 0, endMs: 1000), MediaRange(startMs: 2000, endMs: 4000)], camera: CameraSettings(visible: true, shape: "circle", x: 0.72, y: 0.55, size: 0.2, shadow: true, hiddenRanges: [MediaRange(startMs: 2200, endMs: 2800)]), zooms: [Zoom(id: "z", startMs: 100, endMs: 900, scale: 1.7, x: 0.3, y: 0.3)], overlays: [Overlay(id: "text", kind: "text", startMs: 2000, endMs: 4000, text: "Merhaba dünya — İstanbul", assetId: nil, x: 0.05, y: 0.08, width: 0.65, fontSize: 54, color: "#ffffff", animation: "fade")], audio: EditState.Audio(microphoneVolume: 0.8, systemVolume: 1), cursor: EditState.Cursor(visible: true, highlight: true, smooth: true, size: 1), captions: EditState.Captions(enabled: true, fontSize: 42, color: "#ffffff", background: "#111318")), transcript: [TranscriptSegment(id: "s", startMs: 2000, endMs: 4000, text: "Altyazı: ş ğ ü ı ö ç")], assets: [])
            assert(readCursor(Data("[{\"tMs\":0,\"x\":0.5,\"y\":0.5},{\"tMs\":".utf8)).count == 1)
            project.source?.fps = 29.999998092651367
            let fractional = try decode(Project.self, jsonObject(project)); assert(fractional.source!.fps > 29.99 && fractional.source!.fps < 30)
            assert(sourceTime(project.edits.segments, 1500) == 2500)
            assert(sourceTime(project.edits.segments, 1000) == 2000)
            assert(timelineDuration(project.edits.segments) == 3000)
            let cursorSource = CGRect(x: 100, y: 490, width: 640, height: 392)
            let cursorSurface = CGRect(x: 0, y: 0, width: 1175.5101776123047 / 1280, height: 1)
            let mapped = cursorPosition(CGPoint(x: 580, y: 686), captureRect: cursorSource, normalizedContentRect: cursorSurface)!
            assert(abs(mapped.x - 0.68877549) < 0.00001 && abs(mapped.y - 0.5) < 0.00001, "Cursor did not account for actual SCK pillarboxing")
            assert(cursorPosition(CGPoint(x: 99, y: 686), captureRect: cursorSource, normalizedContentRect: cursorSurface) == nil)
            let built = try await makeComposition(project, directory: dir.path)
            assert(abs(milliseconds(built.composition.duration) - 3000) < 2)
            let generator = AVAssetImageGenerator(asset: built.composition); generator.videoComposition = built.video
            generator.requestedTimeToleranceBefore = .zero; generator.requestedTimeToleranceAfter = .zero
            let visible = try await generator.image(at: mediaTime(2100)).image
            let hidden = try await generator.image(at: mediaTime(1500)).image
            let repeated = try await generator.image(at: mediaTime(2100)).image
            assert(imageBytes(visible) == imageBytes(repeated), "Seek output is not deterministic")
            let visiblePixel = pixel(visible, x: 525, y: 232), hiddenPixel = pixel(hidden, x: 525, y: 232)
            assert(visiblePixel[1] > visiblePixel[0] + 80, "Camera should be visible and green: \(visiblePixel)")
            assert(hiddenPixel[1] < 100, "Camera hidden interval not honored: \(hiddenPixel)")
            assert(brightPixels(visible, in: CGRect(x: 35, y: 25, width: 400, height: 90)) > 120, "Text overlay has no rendered white glyphs")
            assert(brightPixels(visible, in: CGRect(x: 64, y: 275, width: 512, height: 75)) > 80, "Caption background rendered without white glyphs")
            let png = NSBitmapImageRep(cgImage: visible).representation(using: .png, properties: [:])!; try png.write(to: dir.appendingPathComponent("preview.png"))
            project.source?.cameraActiveRanges = [MediaRange(startMs: 0, endMs: 3500)]
            let unavailableBuilt = try await makeComposition(project, directory: dir.path)
            let unavailableGenerator = AVAssetImageGenerator(asset: unavailableBuilt.composition); unavailableGenerator.videoComposition = unavailableBuilt.video
            let unavailable = try await unavailableGenerator.image(at: mediaTime(2800)).image
            assert(pixel(unavailable, x: 525, y: 232)[1] < 100, "Hardware-off camera gap must stay hidden")
            project.edits.camera.shape = "square"
            let exportPath = dir.appendingPathComponent("export.mp4").path
            _ = try await NativeApp.shared.command("export.start", ["project": try jsonObject(project), "projectDir": dir.path, "path": exportPath, "width": 1920, "height": 1080, "jobId": "test-export"])
            for _ in 0..<300 {
                let result = try await NativeApp.shared.command("export.status", ["jobId": "test-export"]) as! [String: Any]
                if result["status"] as? String == "completed" { break }
                if result["status"] as? String == "failed" { throw NativeFailure("Export failed: \(result)") }
                try await Task.sleep(nanoseconds: 100_000_000)
            }
            let inspected = try await NativeApp.shared.inspectMedia(exportPath)
            assert(inspected["width"] as? Int == 1920 && inspected["height"] as? Int == 1080)
            assert(abs((inspected["durationMs"] as! Double) - 3000) < 100)
            let exportedAsset = AVURLAsset(url: URL(fileURLWithPath: exportPath))
            let exportedGenerator = AVAssetImageGenerator(asset: exportedAsset); exportedGenerator.requestedTimeToleranceBefore = .zero; exportedGenerator.requestedTimeToleranceAfter = .zero
            let referenceBuilt = try await makeComposition(project, directory: dir.path, width: 1920, height: 1080)
            let referenceGenerator = AVAssetImageGenerator(asset: referenceBuilt.composition); referenceGenerator.videoComposition = referenceBuilt.video; referenceGenerator.requestedTimeToleranceBefore = .zero; referenceGenerator.requestedTimeToleranceAfter = .zero
            let rendered = try await referenceGenerator.image(at: mediaTime(2100)).image, encoded = try await exportedGenerator.image(at: mediaTime(2100)).image
            for (x, y) in [(1600, 700), (800, 450), (1800, 150)] {
                let a = pixel(rendered, x: x, y: y), b = pixel(encoded, x: x, y: y)
                assert(zip(a.prefix(3), b.prefix(3)).allSatisfy { abs($0 - $1) < 18 }, "Preview/export mismatch \(a), \(b)")
            }
            let fourKPath = dir.appendingPathComponent("export-4k.mp4").path
            _ = try await NativeApp.shared.command("export.start", ["project": try jsonObject(project), "projectDir": dir.path, "path": fourKPath, "width": 3840, "height": 2160, "jobId": "test-4k"])
            for _ in 0..<600 {
                let result = try await NativeApp.shared.command("export.status", ["jobId": "test-4k"]) as! [String: Any]
                if result["status"] as? String == "completed" { break }
                if result["status"] as? String == "failed" { throw NativeFailure("4K export failed: \(result)") }
                try await Task.sleep(nanoseconds: 100_000_000)
            }
            let fourK = try await NativeApp.shared.inspectMedia(fourKPath)
            assert(fourK["width"] as? Int == 3840 && fourK["height"] as? Int == 2160)
            let cancelledPath = dir.appendingPathComponent("cancelled.mp4").path
            _ = try await NativeApp.shared.command("export.start", ["project": try jsonObject(project), "projectDir": dir.path, "path": cancelledPath, "width": 3840, "height": 2160, "jobId": "cancelled"])
            let cancelled = try await NativeApp.shared.command("export.cancel", ["jobId": "cancelled"]) as! [String: Any]
            assert(cancelled["status"] as? String == "cancelled")
            try await Task.sleep(nanoseconds: 100_000_000)
            assert(!FileManager.default.fileExists(atPath: cancelledPath) && NativeApp.shared.jobs["cancelled"]?.session == nil)
            assert(NativeApp.shared.jobs["test-export"]?.session == nil, "Completed export retained media resources")
            let window = NSWindow(contentRect: CGRect(x: 0, y: 0, width: 1000, height: 700), styleMask: [.titled], backing: .buffered, defer: false)
            NativeApp.shared.attach(window)
            _ = try await NativeApp.shared.command("preview.load", ["project": try jsonObject(project), "projectDir": dir.path])
            _ = try await NativeApp.shared.command("preview.seek", ["timeMs": 500])
            _ = try await NativeApp.shared.command("preview.load", ["project": try jsonObject(project), "projectDir": dir.path])
            assert(abs((NativeApp.shared.previewStatus()["timeMs"] as! Double) - 500) < 34, "Editing reset the playhead")
            var other = project; other.id = "other-project"
            _ = try await NativeApp.shared.command("preview.load", ["project": try jsonObject(other), "projectDir": dir.path])
            assert((NativeApp.shared.previewStatus()["timeMs"] as! Double) < 34, "Switching projects retained old playhead")
            _ = try await NativeApp.shared.command("preview.bounds", ["x": 100, "y": 50, "width": 640, "height": 360])
            assert(NativeApp.shared.preview?.isHidden == false)
            _ = try await NativeApp.shared.command("preview.bounds", ["x": 0, "y": 0, "width": 0, "height": 0])
            _ = try await NativeApp.shared.command("preview.load", ["project": try jsonObject(project), "projectDir": dir.path])
            assert(NativeApp.shared.preview?.isHidden == true, "Loading media exposed the preview behind a modal")
            var clamped = project; clamped.edits.camera.x = 0.99; clamped.edits.camera.y = 0.99; clamped.edits.camera.size = 0.9
            let clampedBuilt = try await makeComposition(clamped, directory: dir.path)
            let clampedGenerator = AVAssetImageGenerator(asset: clampedBuilt.composition); clampedGenerator.videoComposition = clampedBuilt.video
            let clampedFrame = try await clampedGenerator.image(at: mediaTime(2100)).image
            assert(pixel(clampedFrame, x: 400, y: 100)[1] > 180, "Camera position/size were not clamped to the canvas")
            let bins = try await analyzeAudio(dir.appendingPathComponent("media/mic.wav"))
            assert(bins.count == 200 && bins.prefix(45).allSatisfy { $0["db"]! > -30 } && bins[60...90].allSatisfy { $0["db"]! < -100 })
            _ = try await prepareAudio(project.source!, directory: dir.path, destination: dir.appendingPathComponent("speech.wav").path)
            let speech = try Data(contentsOf: dir.appendingPathComponent("speech.wav")); assert(speech.prefix(4) == Data("RIFF".utf8))
            do { _ = try projectURL(dir.path, "../escape"); assertionFailure("Traversal accepted") } catch {}
            let job = try await NativeApp.shared.command("export.status", ["jobId": "test-export"]) as! [String: Any]; assert(job["status"] as? String == "completed")
            print("Native checks passed: deterministic seek, source-time cuts, circle camera mask and visibility, text/captions/cursor/zoom, 1080p/4K H.264 export with audio and preview pixel parity, 20ms silence bins, 16k WAV, path validation, cancellation cleanup, camera bounds, project switching and modal preview hiding.")
            print("Artifacts: \(dir.path)")
        } catch { fputs("Native check failed: \(error)\n", stderr); exit(1) }
    }
    static func syntheticAudio() -> Data {
        var data = Data()
        for index in 0..<(16000 * 4) { let amplitude = (index / 16000) % 2 == 0 ? sin(Double(index) * 2 * .pi * 440 / 16000) * 8000 : 0; var value = Int16(amplitude).littleEndian; withUnsafeBytes(of: &value) { data.append(contentsOf: $0) } }; return data
    }
    static func syntheticVideo(_ url: URL, camera: Bool) async throws {
        let writer = try AVAssetWriter(outputURL: url, fileType: .mov)
        let input = AVAssetWriterInput(mediaType: .video, outputSettings: [AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: 640, AVVideoHeightKey: 360])
        let adapter = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA, kCVPixelBufferWidthKey as String: 640, kCVPixelBufferHeightKey as String: 360])
        writer.add(input); guard writer.startWriting() else { throw writer.error! }; writer.startSession(atSourceTime: .zero)
        let context = CIContext()
        for i in 0..<120 {
            while !input.isReadyForMoreMediaData { try await Task.sleep(nanoseconds: 2_000_000) }
            var buffer: CVPixelBuffer?; CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, adapter.pixelBufferPool!, &buffer)
            let bounds = CGRect(x: 0, y: 0, width: 640, height: 360)
            let base = CIImage(color: camera ? CIColor(red: 0.05, green: 0.9, blue: 0.1) : CIColor(red: 0.45, green: 0.08, blue: 0.18)).cropped(to: bounds)
            let tile = CIImage(color: CIColor(red: 0.2, green: 0.2, blue: 0.9)).cropped(to: CGRect(x: i * 3, y: 60, width: 55, height: 70))
            context.render(camera ? base : tile.composited(over: base), to: buffer!)
            guard adapter.append(buffer!, withPresentationTime: CMTime(value: Int64(i), timescale: 30)) else { throw writer.error! }
        }
        input.markAsFinished(); writer.endSession(atSourceTime: CMTime(seconds: 4, preferredTimescale: 600)); await writer.finishWriting()
        guard writer.status == .completed else { throw writer.error ?? NativeFailure("Synthetic writing failed.") }
    }
    static func imageBytes(_ image: CGImage) -> Data { image.dataProvider!.data! as Data }
    static func brightPixels(_ image: CGImage, in rect: CGRect) -> Int {
        var bytes = [UInt8](repeating: 0, count: image.width * image.height * 4)
        bytes.withUnsafeMutableBytes { raw in
            let c = CGContext(data: raw.baseAddress, width: image.width, height: image.height, bitsPerComponent: 8, bytesPerRow: image.width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            c.translateBy(x: 0, y: CGFloat(image.height)); c.scaleBy(x: 1, y: -1); c.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
        }
        var count = 0
        for y in max(0, Int(rect.minY))..<min(image.height, Int(rect.maxY)) { for x in max(0, Int(rect.minX))..<min(image.width, Int(rect.maxX)) { let i = (y * image.width + x) * 4; if bytes[i] > 220 && bytes[i + 1] > 220 && bytes[i + 2] > 220 { count += 1 } } }
        return count
    }
    static func pixel(_ image: CGImage, x: Int, y: Int) -> [Int] {
        var p = [UInt8](repeating: 0, count: 4)
        p.withUnsafeMutableBytes { raw in let c = CGContext(data: raw.baseAddress, width: 1, height: 1, bitsPerComponent: 8, bytesPerRow: 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!; c.translateBy(x: -CGFloat(x), y: -CGFloat(image.height - y - 1)); c.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height)) }
        return p.map(Int.init)
    }
}
