import AppKit
import AVFoundation
import CoreImage
import ImageIO

@main struct NativeCheck {
    @MainActor static func main() async {
        do {
            _ = NSApplication.shared
            renderMetricChecks()
            try permissionRequestChecks()
            if CommandLine.arguments.count > 1 && CommandLine.arguments[1] == "--permissions-check" {
                print("Screen and input permission checks passed: already granted, granted after request, settings fallback, stale request result, clear open failure. No system permissions were requested or changed."); return
            }
            if CommandLine.arguments.count > 1 && CommandLine.arguments[1] == "--pattern" {
                NSApp.setActivationPolicy(.accessory)
                let window = NSWindow(contentRect: CGRect(x: 100, y: 100, width: 640, height: 360), styleMask: [.titled], backing: .buffered, defer: false)
                window.title = "Recora Screen Capture Test"; window.contentView?.wantsLayer = true; window.contentView?.layer?.backgroundColor = NSColor.systemIndigo.cgColor
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
                guard let selected = sources.first(where: { ($0["name"] as? String ?? "").contains("Recora Screen Capture Test") && $0["kind"] as? String == "window" }) else { throw NativeFailure("Synthetic capture window could not be located; screen permission may be missing.") }
                let dir = FileManager.default.temporaryDirectory.appendingPathComponent("screenrec-capture-check-\(UUID().uuidString)", isDirectory: true)
                let settings = CaptureSettings(sourceId: selected["id"] as! String, sourceKind: "window", region: nil, cameraId: nil, microphoneId: "BuiltInMicrophoneDevice", systemAudio: true, cameraShape: "circle", width: 1280, height: 720, fps: 30)
                _ = try await CaptureEngine.shared.start(projectID: "capture-check", directory: dir.path, settings: settings)
                try await Task.sleep(nanoseconds: 1_500_000_000)
                _ = try await CaptureEngine.shared.pause(); try await Task.sleep(nanoseconds: 300_000_000); _ = try await CaptureEngine.shared.resume()
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
            let previewWidth = CommandLine.arguments.contains("--preview-4k-check") ? 3840 : 640, previewHeight = previewWidth * 9 / 16
            try await syntheticVideo(source, camera: false, height: previewHeight, width: previewWidth); try await syntheticVideo(camera, camera: true)
            try (wavHeader(16000 * 2 * 4) + syntheticAudio()).write(to: dir.appendingPathComponent("media/mic.wav"))
            let cursor = (0..<120).map { CursorEvent(tMs: Double($0) * 1000 / 30, x: 0.2 + Double($0) / 240, y: 0.2 + Double($0) / 600, click: $0 > 80) }
            try JSONEncoder().encode(cursor).write(to: dir.appendingPathComponent("media/cursor.json"))
            var project = Project(schemaVersion: 2, id: "test", name: "Synthetic native check", source: RecordingSource(durationMs: 4000, width: previewWidth, height: previewHeight, fps: 30, screen: "media/screen.mov", camera: "media/camera.mov", microphone: "media/mic.wav", systemAudio: nil, cursor: "media/cursor.json"), edits: EditState(segments: [MediaRange(startMs: 0, endMs: 1000), MediaRange(startMs: 2000, endMs: 4000)], camera: CameraSettings(visible: true, shape: "circle", x: 0.72, y: 0.55, size: 0.2, shadow: true, hiddenRanges: [MediaRange(startMs: 2200, endMs: 2800)]), zooms: [Zoom(id: "z", startMs: 100, endMs: 900, scale: 1.7, x: 0.3, y: 0.3)], overlays: [Overlay(id: "text", kind: "text", startMs: 2000, endMs: 4000, text: "Merhaba dünya — İstanbul", assetId: nil, x: 0.05, y: 0.08, width: 0.65, fontSize: 54, color: "#ffffff", animation: "fade")], audio: EditState.Audio(microphoneVolume: 0.8, systemVolume: 1), cursor: EditState.Cursor(visible: true, highlight: true, smooth: true, size: 1), captions: EditState.Captions(enabled: true, fontSize: 42, color: "#ffffff", background: "#111318")), transcript: [TranscriptSegment(id: "s", startMs: 2000, endMs: 4000, text: "Altyazı: ş ğ ü ı ö ç")], assets: [])
            try await timelineEditingChecks(project, directory: dir)
            try await timelineMediaChecks(project, directory: dir)
            try await editorFeatureChecks(project, directory: dir)
            try cameraLayoutChecks(project)
            try await splitZoomChecks(project, directory: dir)
            try await livePreviewChecks(project, directory: dir)
            if CommandLine.arguments.contains("--preview-check") || CommandLine.arguments.contains("--preview-4k-check") { print("Live preview checks passed: stable player item, paused frame redraw, geometry, native handles, coalesced seek, stale draft rejection and camera ranges. Artifacts: \(dir.path)"); return }
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
                assertVisualMatch(rendered, encoded, x: x, y: y, label: "Preview/export")
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
            try await canvasAndSpeedChecks(project, directory: dir)
            print("Native checks passed: deterministic seek, source-time cuts/speeds, all-track retiming, circle camera mask and visibility, text/captions/cursor/zoom, canvas backgrounds/frames/aspects/blur, 1080p/4K/portrait H.264 export with audio and preview pixel parity, 20ms silence bins, 16k WAV, path validation, cancellation cleanup, camera bounds, project switching and modal preview hiding.")
            print("Artifacts: \(dir.path)")
        } catch { fputs("Native check failed: \(error)\n", stderr); exit(1) }
    }
    @MainActor static func timelineMediaChecks(_ project: Project, directory: URL) async throws {
        let frames = try await NativeApp.shared.timelineFrames(directory.appendingPathComponent("media/screen.mov").path, image: false, startMs: 500, endMs: 1500)
        assert(frames.count == 8 && Set(frames.map { $0["src"] as! String }).count > 1, "Filmstrip did not sample real changing frames")
        for frame in frames {
            let time = frame["timeMs"] as! Double, data = Data(base64Encoded: String((frame["src"] as! String).dropFirst("data:image/jpeg;base64,".count)))!
            let image = NSBitmapImageRep(data: data)!
            assert(time >= 466 && time <= 1534 && image.pixelsWide <= 192 && image.pixelsHigh <= 108)
        }
        let imageFrames = try await NativeApp.shared.timelineFrames(directory.appendingPathComponent("media/insert.png").path, image: true, startMs: 1000, endMs: 2000)
        assert(imageFrames.count == 8 && Set(imageFrames.map { $0["src"] as! String }).count == 1)
        let samples = try await audioWaveform(directory.appendingPathComponent("media/mic.wav"), startMs: 0, endMs: 4000)
        assert(samples.count == 256 && samples[0..<64].allSatisfy { $0 > 0.15 } && samples[64..<128].allSatisfy { $0 < 0.001 } && samples[128..<192].allSatisfy { $0 > 0.15 }, "Waveform lost real tone/silence timing")
        let silence = try await audioWaveform(directory.appendingPathComponent("media/mic.wav"), startMs: 1000, endMs: 2000)
        assert(silence.allSatisfy { $0 < 0.001 }, "Waveform interval was ignored")
        let imported = try await audioWaveform(directory.appendingPathComponent("media/insert-with-audio.mov"), startMs: 2000, endMs: 2500)
        assert(imported.count == 256 && imported.allSatisfy { $0 > 0.15 }, "Imported video's real audio was not sampled")
        let silentVideo = try await audioWaveform(directory.appendingPathComponent("media/screen.mov"), startMs: 0, endMs: 1000)
        assert(silentVideo.isEmpty, "Silent video fabricated an audio waveform")
        print("Timeline media checks passed: bounded real filmstrip frames, still images, source-interval waveform timing, video audio and silent-source handling.")
    }
    @MainActor static func timelineEditingChecks(_ original: Project, directory: URL) async throws {
        let portrait = directory.appendingPathComponent("media/insert-portrait.mov")
        try await syntheticVideo(portrait, camera: false, height: 640, width: 360)
        let media = AVMutableComposition(), movie = AVURLAsset(url: portrait), tone = AVURLAsset(url: directory.appendingPathComponent("media/mic.wav"))
        let video = media.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
        try video.insertTimeRange(CMTimeRange(start: .zero, duration: mediaTime(4000)), of: try await movie.loadTracks(withMediaType: .video).first!, at: .zero)
        video.preferredTransform = CGAffineTransform(a: 0, b: 1, c: -1, d: 0, tx: 640, ty: 0)
        try media.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!.insertTimeRange(CMTimeRange(start: .zero, duration: mediaTime(4000)), of: try await tone.loadTracks(withMediaType: .audio).first!, at: .zero)
        let insertedMovie = directory.appendingPathComponent("media/insert-with-audio.mov")
        try await AVAssetExportSession(asset: media, presetName: AVAssetExportPresetPassthrough)!.export(to: insertedMovie, as: .mov)
        let still = CIImage(color: CIColor(red: 0.1, green: 0.8, blue: 0.9)).cropped(to: CGRect(x: 0, y: 0, width: 320, height: 180))
        let context = CIContext(), image = context.createCGImage(still, from: still.extent)!
        try NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:])!.write(to: directory.appendingPathComponent("media/insert.png"))
        var project = original
        project.assets += [MediaAsset(id: "insert-video", name: "Inserted video", path: "media/insert-with-audio.mov", kind: "video", durationMs: 4000, width: 640, height: 360), MediaAsset(id: "insert-image", name: "Inserted still", path: "media/insert.png", kind: "image")]
        project.edits.segments = [MediaRange(startMs: 2000, endMs: 3000), MediaRange(startMs: 0, endMs: 1000, speed: 2, assetId: "insert-video"), MediaRange(startMs: 0, endMs: 700, assetId: "insert-image"), MediaRange(startMs: 0, endMs: 500), MediaRange(startMs: 2000, endMs: 2500, speed: 0.5, assetId: "insert-video"), MediaRange(startMs: 2000, endMs: 2500), MediaRange(startMs: 0, endMs: 400, assetId: "insert-image")]
        project.edits.canvas = CanvasSettings(); project.edits.audio.microphoneVolume = 0; project.edits.audio.systemVolume = 0.6
        project.edits.overlays = [Overlay(id: "source-cover", kind: "redact", startMs: 0, endMs: 4000, text: nil, assetId: nil, x: 0, y: 0, width: 1, fontSize: 48, color: "#000000", animation: "none", height: 1)]
        assert(timelineDuration(project.edits.segments) == 4600 && sourceTime(project.edits.segments, 100) == 2100 && sourceTime(project.edits.segments, 1200) == -1 && sourceTime(project.edits.segments, 1800) == -1 && sourceTime(project.edits.segments, 2300) == 100 && sourceTime(project.edits.segments, 3800) == 2100)
        func generator(_ project: Project) async throws -> (BuiltComposition, AVAssetImageGenerator) {
            let built = try await makeComposition(project, directory: directory.path, width: 640, height: 360)
            let generator = AVAssetImageGenerator(asset: built.composition); generator.videoComposition = built.video
            generator.requestedTimeToleranceBefore = .zero; generator.requestedTimeToleranceAfter = .zero
            return (built, generator)
        }
        let (built, preview) = try await generator(project)
        assert(abs(milliseconds(built.composition.duration) - 4600) < 1, "Image tail truncated the composition")
        let primary = built.composition.track(withTrackID: built.instruction.screenID)!
        let occupied = primary.segments.filter { !$0.isEmpty }
        assert(occupied.count == project.edits.segments.count && abs(milliseconds(occupied[0].timeMapping.source.start) - 2000) < 1 && abs(milliseconds(occupied[5].timeMapping.source.start) - 2000) < 1)
        let originalAudio = built.composition.tracks(withMediaType: .audio).filter { built.audioKinds[$0.trackID] == "microphone" }
        assert(originalAudio.reduce(0) { $0 + $1.segments.filter { !$0.isEmpty }.count } == 3, "Original microphone leaked into inserted segments")
        var plain = project; plain.edits.overlays = []; plain.edits.zooms = []; plain.edits.camera.visible = false; plain.edits.cursor.visible = false; plain.edits.captions.enabled = false
        let (_, plainPreview) = try await generator(plain)
        for time in [1200.0, 1800, 3100, 4500] {
            let actual = try await preview.image(at: mediaTime(time)).image, expected = try await plainPreview.image(at: mediaTime(time)).image
            assert(imageBytes(actual) == imageBytes(expected), "An original effect leaked onto inserted media")
        }
        let originalFrame = try await preview.image(at: mediaTime(100)).image, repeatedFrame = try await preview.image(at: mediaTime(3800)).image
        assert(pixel(originalFrame, x: 320, y: 180).prefix(3).allSatisfy { $0 < 5 } && imageBytes(originalFrame) == imageBytes(repeatedFrame), "Reordered/repeated source effects lost their source anchor")
        let rawVideo = AVAssetImageGenerator(asset: AVURLAsset(url: insertedMovie)); rawVideo.appliesPreferredTrackTransform = true; rawVideo.requestedTimeToleranceBefore = .zero; rawVideo.requestedTimeToleranceAfter = .zero
        let rawFrame = try await rawVideo.image(at: mediaTime(400)).image, insertedFrame = try await preview.image(at: mediaTime(1200)).image
        try NSBitmapImageRep(cgImage: rawFrame).representation(using: .png, properties: [:])!.write(to: directory.appendingPathComponent("insert-raw.png"))
        try NSBitmapImageRep(cgImage: insertedFrame).representation(using: .png, properties: [:])!.write(to: directory.appendingPathComponent("insert-composed.png"))
        assert(rawFrame.width == 640 && rawFrame.height == 360)
        let content = CanvasLayout(project: project, bounds: CGRect(x: 0, y: 0, width: 640, height: 360)).content
        for (x, y) in [(80, 80), (440, 200), (540, 250)] {
            let expected = meanPixel(rawFrame, x: x, y: y), actual = meanPixel(insertedFrame, x: Int(content.minX + Double(x) / 640 * content.width), y: Int(360 - content.maxY + Double(y) / 360 * content.height))
            assert(zip(expected, actual).allSatisfy { abs($0 - $1) < 32 }, "Inserted video's preferred transform changed at \(x),\(y): \(expected) vs \(actual)")
        }
        var muted = project; muted.edits.audio.systemVolume = 0
        let live = try await updateComposition(muted, previous: built)
        for parameter in live.audio.inputParameters where live.audioKinds[parameter.trackID]?.hasPrefix("video:") == true {
            var start: Float = 1, end: Float = 1, range = CMTimeRange.zero
            assert(parameter.getVolumeRamp(for: .zero, startVolume: &start, endVolume: &end, timeRange: &range) && start == 0)
        }
        let output = directory.appendingPathComponent("timeline-inserts.mp4"), session = AVAssetExportSession(asset: built.composition, presetName: AVAssetExportPresetHighestQuality)!
        session.videoComposition = built.video; session.audioMix = built.audio
        try await session.export(to: output, as: .mp4)
        let encoded = AVAssetImageGenerator(asset: AVURLAsset(url: output)); encoded.requestedTimeToleranceBefore = .zero; encoded.requestedTimeToleranceAfter = .zero
        for time in [1200.0, 1800, 3100, 4500] { assertVisualMatch(try await encoded.image(at: mediaTime(time)).image, try await preview.image(at: mediaTime(time)).image, x: 320, y: 180, label: "Inserted media preview/export") }
        for (start, end) in [(1100.0, 1400.0), (2900, 3400)] { let pitch = try await tonePitch(output, fromMs: start, toMs: end); assert(abs(pitch - 440) < 20, "Inserted video audio lost timing/pitch: \(pitch)") }
        var imagesOnly = project; imagesOnly.id = "images-only"; imagesOnly.edits.segments = [MediaRange(startMs: 0, endMs: 500, assetId: "insert-image"), MediaRange(startMs: 100, endMs: 600, speed: 0.5, assetId: "insert-image")]
        let (imageBuilt, imagePreview) = try await generator(imagesOnly)
        assert(abs(milliseconds(imageBuilt.composition.duration) - 1500) < 1)
        let finalImage = try await imagePreview.image(at: mediaTime(1466.6667)).image
        assert(pixel(finalImage, x: 320, y: 180)[1] > 180)
        _ = try await NativeApp.shared.command("preview.load", ["project": try jsonObject(imagesOnly), "projectDir": directory.path])
        _ = try await NativeApp.shared.command("preview.seek", ["timeMs": 1200])
        assert(NativeApp.shared.player?.currentItem?.status == .readyToPlay && abs(milliseconds(NativeApp.shared.player!.currentTime()) - 1200) < 40)
        assert((NativeApp.shared.previewGeometry(at: 1200)["items"] as! [[String: Any]]).isEmpty, "Source handles leaked into inserted image")
        let imageOutput = directory.appendingPathComponent("timeline-images.mp4"), imageSession = AVAssetExportSession(asset: imageBuilt.composition, presetName: AVAssetExportPresetHighestQuality)!
        imageSession.videoComposition = imageBuilt.video
        try await imageSession.export(to: imageOutput, as: .mp4)
        let imageInfo = try await NativeApp.shared.inspectMedia(imageOutput.path)
        assert(abs((imageInfo["durationMs"] as! Double) - 1500) < 40)
        let gif = directory.appendingPathComponent("timeline-images.gif")
        _ = try await NativeApp.shared.command("export.start", ["project": try jsonObject(imagesOnly), "projectDir": directory.path, "path": gif.path, "width": 640, "height": 360, "format": "gif", "gifFps": 20, "jobId": "timeline-images-gif"])
        for _ in 0..<200 {
            let result = try await NativeApp.shared.command("export.status", ["jobId": "timeline-images-gif"]) as! [String: Any]
            if result["status"] as? String == "completed" { break }
            if result["status"] as? String == "failed" { throw NativeFailure("Image-only GIF failed: \(result)") }
            try await Task.sleep(nanoseconds: 50_000_000)
        }
        let gifSource = CGImageSourceCreateWithURL(gif as CFURL, nil)!
        assert(CGImageSourceGetCount(gifSource) == 30 && pixel(CGImageSourceCreateImageAtIndex(gifSource, 29, nil)!, x: 320, y: 180)[1] > 180)
        var invalid = project; invalid.edits.segments[1].endMs = 5000
        do { _ = try await makeComposition(invalid, directory: directory.path); assertionFailure("Oversized video range accepted") } catch { assert((error as? NativeFailure)?.code == "invalid_project") }
        invalid = project; invalid.assets[0].path = "../escape.mov"
        do { _ = try await makeComposition(invalid, directory: directory.path); assertionFailure("Inserted media escaped project") } catch { assert((error as? NativeFailure)?.code == "invalid_path") }
        print("Timeline editing checks passed: reorder/repeats, inserted oriented video/audio, stills between clips and at tail, image-only player/MP4/GIF, source-effect isolation and preview/export parity.")
    }
    @MainActor static func editorFeatureChecks(_ original: Project, directory: URL) async throws {
        var project = original
        project.edits.segments = [MediaRange(startMs: 0, endMs: 2000)]
        project.edits.canvas = nil; project.edits.zooms = []; project.edits.overlays = []
        project.edits.camera.visible = false; project.edits.cursor.visible = false; project.edits.captions.enabled = false
        project.source?.microphone = nil; project.source?.systemAudio = nil
        func frame(_ project: Project, at time: Double) async throws -> CGImage {
            let built = try await makeComposition(project, directory: directory.path, width: 640, height: 360)
            let generator = AVAssetImageGenerator(asset: built.composition); generator.videoComposition = built.video
            generator.requestedTimeToleranceBefore = .zero; generator.requestedTimeToleranceAfter = .zero
            return try await generator.image(at: mediaTime(time)).image
        }
        func export(_ project: Project, name: String, format: String = "mp4", loop: Bool = true) async throws -> URL {
            let url = directory.appendingPathComponent(name + "." + format)
            _ = try await NativeApp.shared.command("export.start", ["project": try jsonObject(project), "projectDir": directory.path, "path": url.path, "width": 640, "height": 360, "format": format, "gifFps": 15, "loop": loop, "jobId": name])
            for _ in 0..<600 {
                let status = try await NativeApp.shared.command("export.status", ["jobId": name]) as! [String: Any]
                if status["status"] as? String == "completed" { return url }
                if status["status"] as? String == "failed" { throw NativeFailure("Feature export failed: \(status)") }
                try await Task.sleep(nanoseconds: 50_000_000)
            }
            throw NativeFailure("Feature export timed out")
        }
        let plain = try await frame(project, at: 500)
        let cover = Overlay(id: "cover", kind: "redact", startMs: 0, endMs: 1000, text: nil, assetId: nil, x: 0.05, y: 0.05, width: 0.45, fontSize: 48, color: "#00000000", animation: "fade", height: 0.8)
        let arrow = Overlay(id: "arrow", kind: "arrow", startMs: 0, endMs: 2000, text: nil, assetId: nil, x: 0.55, y: 0.1, width: 0.35, fontSize: 48, color: "#ffffff", animation: "none", height: 0.3, rotation: 45)
        project.edits.overlays = [cover, arrow, Overlay(id: "late-text", kind: "text", startMs: 0, endMs: 2000, text: "Covered text", assetId: nil, x: 0.1, y: 0.2, width: 0.3, fontSize: 60, color: "#ffffff", animation: "none")]
        let start = try await frame(project, at: 0)
        assert(pixel(start, x: 100, y: 100).prefix(3).allSatisfy { $0 < 4 }, "Cover is transparent or fades at its start")
        assert(brightPixels(start, in: CGRect(x: 34, y: 20, width: 280, height: 280)) == 0, "Later text bypasses the cover")
        try NSBitmapImageRep(cgImage: start).representation(using: .png, properties: [:])!.write(to: directory.appendingPathComponent("new-features-start.png"))
        print("New feature pixels: \(directory.path)/new-features-start.png")
        assert(pixel(start, x: 464, y: 90).prefix(3).allSatisfy { $0 > 220 }, "Arrow was not rendered")
        let ended = try await frame(project, at: 1000)
        assert(pixel(ended, x: 100, y: 50)[0] > 40, "Cover persists beyond its interval")
        let gif = try await export(project, name: "features-loop", format: "gif")
        guard let gifSource = CGImageSourceCreateWithURL(gif as CFURL, nil) else { throw NativeFailure("GIF cannot be decoded") }
        assert(CGImageSourceGetCount(gifSource) == 30, "Wrong GIF frame count")
        let properties = CGImageSourceCopyProperties(gifSource, nil) as? [String: Any]
        assert((properties?[kCGImagePropertyGIFDictionary as String] as? [String: Any])?[kCGImagePropertyGIFLoopCount as String] as? Int == 0)
        let gifFrame = CGImageSourceCreateImageAtIndex(gifSource, 0, nil)!
        assert(gifFrame.width == 640 && gifFrame.height == 360)
        assert(pixel(gifFrame, x: 100, y: 100).prefix(3).allSatisfy { $0 < 6 }, "GIF lost its cover")
        var gifDuration = 0.0
        for index in 0..<30 {
            let frameProperties = CGImageSourceCopyPropertiesAtIndex(gifSource, index, nil) as! [String: Any]
            let metadata = frameProperties[kCGImagePropertyGIFDictionary as String] as! [String: Any]
            gifDuration += metadata[kCGImagePropertyGIFUnclampedDelayTime as String] as? Double ?? metadata[kCGImagePropertyGIFDelayTime as String] as? Double ?? 0
        }
        assert(abs(gifDuration - 2) < 0.02, "GIF timing drifted")
        let once = try await export(project, name: "features-once", format: "gif", loop: false)
        let onceSource = CGImageSourceCreateWithURL(once as CFURL, nil)!
        let onceProperties = CGImageSourceCopyProperties(onceSource, nil) as? [String: Any]
        assert((onceProperties?[kCGImagePropertyGIFDictionary as String] as? [String: Any])?[kCGImagePropertyGIFLoopCount as String] as? Int == 1, "Non-looping GIF does not play exactly once")
        let onceData = try Data(contentsOf: once)
        assert(onceData.range(of: Data("NETSCAPE2.0".utf8)) == nil, "One-play GIF contains a loop extension")
        let cancelled = directory.appendingPathComponent("cancelled-gif.gif")
        _ = try await NativeApp.shared.command("export.start", ["project":try jsonObject(project), "projectDir":directory.path, "path":cancelled.path, "width":640,"height":360,"format":"gif","jobId":"cancelled-gif"])
        _ = try await NativeApp.shared.command("export.cancel", ["jobId":"cancelled-gif"])
        try await Task.sleep(nanoseconds: 100_000_000)
        assert(!FileManager.default.fileExists(atPath: cancelled.path), "Cancelled GIF was published")
        project.edits.overlays = [Overlay(id: "blur", kind: "blur", startMs: 0, endMs: 2000, text: nil, assetId: nil, x: 0.04, y: 0.6, width: 0.2, fontSize: 48, color: "#ffffff", animation: "slide", height: 0.3, blur: 80)]
        let blurred = try await frame(project, at: 500)
        assert(pixel(plain, x: 44, y: 250) != pixel(blurred, x: 44, y: 250), "Regional blur does not soften the tile edge")
        assertVisualMatch(plain, blurred, x: 500, y: 200, label: "Regional blur outside its bounds")
        project.edits.overlays = [cover, arrow]
        project.assets = [MediaAsset(id: "music", name: "Synthetic tone", path: "media/mic.wav", kind: "audio")]
        project.edits.audioClips = [AudioClip(id: "music", assetId: "music", startMs: 500, endMs: 1500, offsetMs: 0, volume: 0.5)]
        let audioBuilt = try await makeComposition(project, directory: directory.path, width: 640, height: 360)
        let tracks = audioBuilt.composition.tracks(withMediaType: .audio)
        assert(tracks.count == 1)
        let occupied = tracks[0].segments.filter { !$0.isEmpty }
        assert(abs(milliseconds(occupied[0].timeMapping.target.start) - 500) < 1)
        assert(abs(milliseconds(occupied[0].timeMapping.target.duration) - 1000) < 1)
        var muted = project; muted.edits.audioClips?[0].volume = 0
        let beforeStructure = try mediaStructure(project, directory: directory.path), afterStructure = try mediaStructure(muted, directory: directory.path)
        assert(beforeStructure == afterStructure, "Volume update recreates the player composition")
        let mutedBuilt = try await updateComposition(muted, previous: audioBuilt)
        var startVolume: Float = 1, endVolume: Float = 1, ramp = CMTimeRange.zero
        assert(mutedBuilt.audio.inputParameters[0].getVolumeRamp(for: .zero, startVolume: &startVolume, endVolume: &endVolume, timeRange: &ramp) && startVolume == 0, "Live imported volume update ignored")
        let movie = try await export(project, name: "features-audio")
        let pitch = try await tonePitch(movie, fromMs: 700, toMs: 1200)
        assert(abs(pitch - 440) < 20, "Imported audio missing or wrong pitch: \(pitch)")
        let bins = try await analyzeAudio(movie)
        assert(bins.filter { $0["db"]! > -40 }.allSatisfy { $0["startMs"]! >= 450 && $0["endMs"]! <= 1550 }, "Imported audio timing leaked outside the selected interval")
        let movieGenerator = AVAssetImageGenerator(asset: AVURLAsset(url: movie)); movieGenerator.requestedTimeToleranceBefore = .zero; movieGenerator.requestedTimeToleranceAfter = .zero
        let movieFrame = try await movieGenerator.image(at: .zero).image
        assert(pixel(movieFrame, x: 100, y: 100).prefix(3).allSatisfy { $0 < 10 }, "MP4 lost cover")
        var shortened = project; shortened.edits.segments = [MediaRange(startMs: 0, endMs: 800)]
        let shortBuilt = try await makeComposition(shortened, directory: directory.path)
        assert(abs(milliseconds(shortBuilt.composition.duration) - 800) < 1, "Audio extended a trimmed video")
        project.edits.audioClips = []; project.edits.overlays = []; project.edits.segments = [MediaRange(startMs:0,endMs:4000)]
        project.edits.camera.visible = true; project.edits.camera.hiddenRanges = []; project.edits.camera.shape = "square"; project.edits.camera.size = 0.4; project.edits.camera.x = 0.5; project.edits.camera.y = 0.25; project.edits.camera.radius = 0
        project.source?.camera = "media/screen.mov"
        let normal = try await frame(project, at: 2000)
        project.edits.camera.mirror = true
        let mirrored = try await frame(project, at: 2000)
        assertVisualMatch(normal, mirrored, x: 450, y: 200, label: "Mirror uniform area")
        let left = pixel(normal, x: 355, y: 275), flipped = pixel(mirrored, x: 541, y: 275)
        assert(abs(left[2] - flipped[2]) < 15 && left[2] > 150, "Camera mirror failed")
        project.edits.camera.zoomReactive = true; project.edits.zooms = [Zoom(id:"zoom",startMs:0,endMs:2000,scale:2,x:0.5,y:0.5)]
        let reactive = try await makeComposition(project, directory: directory.path)
        let visual = renderedCamera(reactive.instruction, outputMs: 1000, sourceMs:1000)
        assert(abs(visual.size - 0.2) < 0.0001, "Camera did not shrink with zoom")
        project.edits.camera.visible = false; project.edits.zooms = []; project.edits.cursor.visible = true
        let cursorBase = try await frame(project, at:2800)
        for effect in ["motionBlur", "bounce", "sway", "style"] {
            var changed = project
            switch effect { case "motionBlur": changed.edits.cursor.motionBlur = true; case "bounce": changed.edits.cursor.bounce = true; case "sway": changed.edits.cursor.sway = true; default: changed.edits.cursor.style = "light" }
            let image = try await frame(changed, at:2800)
            assert(imageBytes(image) != imageBytes(cursorBase), "Cursor effect did not render: \(effect)")
        }
        project.edits.cursor.loop = true
        let loopBuilt = try await makeComposition(project, directory: directory.path)
        let first = renderedCursor(loopBuilt.instruction, outputMs:0)!, last = renderedCursor(loopBuilt.instruction, outputMs:3999)!
        assert(abs(first.x - last.x) < 0.001 && abs(first.y - last.y) < 0.001, "Cursor loop is discontinuous")
        print("Editor feature checks passed: opaque covers, arrows, regional blur, imported audio timing/pitch/volume, GIF frames/timing/loop/cancel, cursor effects and camera mirror/zoom geometry.")
    }
    @MainActor static func splitZoomChecks(_ original: Project, directory: URL) async throws {
        var project = original
        project.edits.segments = [MediaRange(startMs: 0, endMs: 4000)]
        project.edits.overlays = []; project.edits.captions.enabled = false
        project.edits.camera.hiddenRanges = []; project.edits.camera.zoomReactive = true
        let zoom = Zoom(id: "left", startMs: 500, endMs: 3500, scale: 2, x: 0.3, y: 0.3, followCursor: true)
        project.edits.zooms = [zoom]
        let baseline = try await makeComposition(project, directory: directory.path, width: 640, height: 360)
        project.edits.segments = [MediaRange(startMs: 0, endMs: 2000), MediaRange(startMs: 2000, endMs: 4000)]
        var left = zoom, right = zoom
        left.endMs = 2000; right.id = "right"; right.startMs = 2000; right.motion = "gentle"
        project.edits.zooms = [left, right]
        let split = try await makeComposition(project, directory: directory.path, width: 640, height: 360)
        let joined = split.instruction.renderZooms
        assert(project.edits.zooms.count == 2 && joined.count == 1 && joined[0].id == "left")
        let originalFrames = AVAssetImageGenerator(asset: baseline.composition), splitFrames = AVAssetImageGenerator(asset: split.composition)
        originalFrames.videoComposition = baseline.video; splitFrames.videoComposition = split.video
        for generator in [originalFrames, splitFrames] { generator.requestedTimeToleranceBefore = .zero; generator.requestedTimeToleranceAfter = .zero }
        for time in [1900.0, 2000.0, 2100.0] {
            assert(zoomAmount(joined[0], at: time) == 1, "A split restarted zoom easing")
            let before = zoomFocus(zoom, path: baseline.instruction.focusPaths[zoom.id] ?? [], at: time)
            let after = zoomFocus(joined[0], path: split.instruction.focusPaths[joined[0].id] ?? [], at: time)
            assert(before == after, "A split restarted cursor following")
            assert(abs(renderedCamera(split.instruction, outputMs: time, sourceMs: time).size - project.edits.camera.size / 2) < 0.0001, "A split restarted camera zoom response")
            let originalFrame = try await originalFrames.image(at: mediaTime(time)).image
            let splitFrame = try await splitFrames.image(at: mediaTime(time)).image
            assert(imageBytes(originalFrame) == imageBytes(splitFrame), "Splitting changed rendered pixels at \(time)ms")
        }
        for property in ["scale", "x", "y", "motion", "followCursor"] {
            var changed = right
            switch property {
            case "scale": changed.scale = 3
            case "x": changed.x = 0.7
            case "y": changed.y = 0.7
            case "motion": changed.motion = "snappy"
            default: changed.followCursor = false
            }
            assert(continuousZooms([left, changed]).count == 2, "Independent zoom \(property) was merged")
        }
        var override = zoom; override.id = "override"; override.startMs = 1800; override.endMs = 2200; override.scale = 3
        assert(continuousZooms([left, override, right]).count == 3, "Coalescing changed overlapping zoom priority")
        project.edits.zooms[1].x = 0.8
        let changed = try await updateComposition(project, previous: split)
        assert(changed.instruction.renderZooms.count == 2 && changed.instruction.focusPaths["right"]?.first?.x == 0.8, "Split edit reused a stale focus path")
        print("Split zoom checks passed: independent settings, continuous easing/following/camera response, unchanged native pixels, overlap priority and live focus cache.")
    }
    @MainActor static func permissionRequestChecks() throws {
        for (kind, pane, name) in [("screen", "Privacy_ScreenCapture", "Screen & System Audio Recording"), ("input", "Privacy_ListenEvent", "Input Monitoring")] {
            var requested = 0, opened = 0
            try NativeApp.shared.requestDesktopPermission(kind, check: { true }, request: { requested += 1; return true }, openSettings: { _ in opened += 1; return true })
            assert(requested == 0 && opened == 0, "Already granted access must not prompt or open Settings")
            var granted = false
            try NativeApp.shared.requestDesktopPermission(kind, check: { granted }, request: { requested += 1; granted = true; return true }, openSettings: { _ in opened += 1; return true })
            assert(requested == 1 && opened == 0, "Newly granted access should not open Settings")
            for requestResult in [false, true] {
                try NativeApp.shared.requestDesktopPermission(kind, check: { false }, request: { requested += 1; return requestResult }, openSettings: { url in
                    assert(url.absoluteString == "x-apple.systempreferences:com.apple.preference.security?\(pane)")
                    opened += 1; return true
                })
            }
            assert(requested == 3 && opened == 2, "Current denied access must open its exact Settings pane regardless of the request result")
            do {
                try NativeApp.shared.requestDesktopPermission(kind, check: { false }, request: { false }, openSettings: { _ in false })
                assertionFailure("Settings open failure was hidden")
            } catch let error as NativeFailure { assert(error.code == "settings_unavailable" && error.message.contains(name)) }
        }
    }
    @MainActor static func canvasAndSpeedChecks(_ source: Project, directory: URL) async throws {
        let alphaColor = color("#12345680", alpha: 0.5)
        assert(abs(alphaColor.redComponent - 18.0 / 255) < 0.001 && abs(alphaColor.alphaComponent - 64.0 / 255) < 0.001)
        try await syntheticVideo(directory.appendingPathComponent("media/four-three.mov"), camera: false, height: 480)
        var legacy = source; legacy.source?.height = 480; legacy.source?.screen = "media/four-three.mov"
        let legacyThumb = directory.appendingPathComponent("legacy-four-three.png")
        _ = try await NativeApp.shared.command("preview.frame", ["project": try jsonObject(legacy), "projectDir": directory.path, "timeMs": 800, "path": legacyThumb.path])
        let legacyBitmap = NSBitmapImageRep(data: try Data(contentsOf: legacyThumb))!
        assert(legacyBitmap.pixelsWide == 960 && legacyBitmap.pixelsHigh == 720, "Legacy 4:3 thumbnail did not match the source aspect")
        var project = source
        project.edits.camera.visible = false; project.edits.cursor.visible = false; project.edits.captions.enabled = false; project.edits.overlays = []; project.edits.zooms = []
        try FileManager.default.copyItem(at: directory.appendingPathComponent(source.source!.microphone!), to: directory.appendingPathComponent("media/system.wav"))
        project.source?.systemAudio = "media/system.wav"
        project.edits.segments = [MediaRange(startMs: 0, endMs: 1000, speed: 2), MediaRange(startMs: 2000, endMs: 3000, speed: 0.5)]
        assert(timelineDuration(project.edits.segments) == 2500 && sourceTime(project.edits.segments, 500) == 2000 && sourceTime(project.edits.segments, 1000) == 2250)
        let sped = try await makeComposition(project, directory: directory.path)
        assert(abs(milliseconds(sped.composition.duration) - 2500) < 2)
        let tracks = try await sped.composition.load(.tracks); assert(tracks.count == 6)
        for track in tracks {
            let range = try await track.load(.timeRange)
            let segments = try await track.load(.segments)
            let ratios = segments.filter { !$0.isEmpty }.map { $0.timeMapping.source.duration.seconds / $0.timeMapping.target.duration.seconds }
            if track.mediaType == .video {
                assert(abs(milliseconds(range.duration) - 2500) < 2 && ratios.count == 2 && abs(ratios[0] - 2) < 0.001 && abs(ratios[1] - 0.5) < 0.001)
            } else { assert(ratios.count == 1 && (abs(ratios[0] - 2) < 0.001 || abs(ratios[0] - 0.5) < 0.001), "Audio rate processor mixes incompatible segment speeds") }
        }
        assert(sped.audio.inputParameters.allSatisfy { $0.audioTimePitchAlgorithm == .spectral })
        var invalid = project; invalid.edits.segments[0].speed = 0
        do { _ = try await makeComposition(invalid, directory: directory.path); assertionFailure("Invalid speed accepted") } catch {}
        var follow = Zoom(id: "follow", startMs: 0, endMs: 2000, scale: 2, x: 0.2, y: 0.2, motion: "gentle", followCursor: true)
        let cursor = (0..<60).map { CursorEvent(tMs: Double($0) * 1000 / 30, x: $0 < 20 ? 0.2 : 0.8, y: 0.3, click: nil) }
        let focus = zoomFocusPath(follow, cursor: cursor)
        assert(zoomFocus(follow, path: focus, at: 200).x == 0.2 && zoomFocus(follow, path: focus, at: 1800).x > 0.7)
        assert(zoomAmount(follow, at: 400) >= 0.99)
        let clickFocus = zoomFocusPath(follow, cursor: cursor, interactions: [CursorEvent(tMs: 800, x: 0.2, y: 0.2, click: true)])
        assert(zoomFocus(follow, path: clickFocus, at: 1000).x == 0.2, "Zoom began following before the action hold completed")
        let gentle = zoomAmount(follow, at: 200); follow.motion = "snappy"
        assert(zoomAmount(follow, at: 200) > gentle && zoomAmount(follow, at: 0) == 0 && zoomAmount(follow, at: 2000) == 0)
        project.edits.zooms = [follow]; project.edits.cursor.visible = true
        project.edits.canvas = CanvasSettings()
        project.source?.title = "Synthetic window title"
        let assetContext = CIContext(), assetBounds = CGRect(x: 0, y: 0, width: 128, height: 128)
        let stripes = CIImage(color: CIColor(red: 1, green: 0.05, blue: 0.03)).cropped(to: assetBounds)
        let split = CIImage(color: CIColor(red: 0.03, green: 0.05, blue: 1)).cropped(to: CGRect(x: 64, y: 0, width: 64, height: 128)).composited(over: stripes)
        let asset = assetContext.createCGImage(split, from: assetBounds)!
        try NSBitmapImageRep(cgImage: asset).representation(using: .png, properties: [:])!.write(to: directory.appendingPathComponent("background.png"))
        project.assets.append(MediaAsset(id: "background", name: "Background", path: "background.png", kind: "image"))
        func image(_ project: Project, at time: Double = 800) async throws -> CGImage {
            let built = try await makeComposition(project, directory: directory.path)
            let generator = AVAssetImageGenerator(asset: built.composition); generator.videoComposition = built.video; generator.requestedTimeToleranceBefore = .zero; generator.requestedTimeToleranceAfter = .zero
            return try await generator.image(at: mediaTime(time)).image
        }
        var frames: [String: CGImage] = [:]
        for background in ["hidden", "color", "gradient", "wallpaper", "image"] {
            project.edits.canvas?.background = background; project.edits.canvas?.color = "#123456"; project.edits.canvas?.assetId = "background"
            frames[background] = try await image(project)
        }
        assert(pixel(frames["hidden"]!, x: 3, y: 3).prefix(3).allSatisfy { $0 < 3 })
        assert(abs(pixel(frames["color"]!, x: 3, y: 3)[0] - 18) < 3)
        assert(imageBytes(frames["gradient"]!) != imageBytes(frames["wallpaper"]!))
        assert(pixel(frames["image"]!, x: 3, y: 3)[0] > 220)
        project.edits.canvas?.background = "image"; project.edits.canvas?.blur = 60
        let blurred = try await image(project); assert(imageBytes(blurred) != imageBytes(frames["image"]!), "Background blur had no effect")
        project.edits.canvas?.background = "wallpaper"; project.edits.canvas?.blur = 0
        var wallpapers: [Data] = []
        for name in ["aurora", "sunset", "ocean", "dusk"] { project.edits.canvas?.wallpaper = name; wallpapers.append(imageBytes(try await image(project))) }
        assert(Set(wallpapers).count == 4, "Wallpaper presets are not distinct")
        project.edits.canvas?.wallpaper = "aurora"
        for aspect in ["source", "16:9", "9:16", "1:1", "4:5"] {
            project.edits.canvas?.aspectRatio = aspect
            let rendered = try await image(project), dimensions = renderDimensions(project)
            assert(rendered.width == Int(dimensions.width) && rendered.height == Int(dimensions.height))
            let thumb = directory.appendingPathComponent("canvas-\(aspect.replacingOccurrences(of: ":", with: "-" )).png")
            _ = try await NativeApp.shared.command("preview.frame", ["project": try jsonObject(project), "projectDir": directory.path, "timeMs": 800, "path": thumb.path])
            let thumbnail = NSBitmapImageRep(data: try Data(contentsOf: thumb))!
            assert(abs(Double(thumbnail.pixelsWide) / Double(thumbnail.pixelsHigh) - dimensions.width / dimensions.height) < 0.005, "Thumbnail aspect was stretched")
        }
        project.edits.canvas?.aspectRatio = "16:9"; project.edits.canvas?.frame = "none"
        let plain = try await image(project); project.edits.canvas?.frame = "minimal"
        let minimal = try await image(project); project.edits.canvas?.frame = "browser"
        let browser = try await image(project)
        assert(imageBytes(plain) != imageBytes(minimal) && imageBytes(minimal) != imageBytes(browser))
        project.edits.canvas?.radius = 0; project.edits.canvas?.shadow = 0
        let square = try await image(project); assert(imageBytes(square) != imageBytes(browser), "Rounded screen/shadow styling had no effect")
        project.edits.canvas?.radius = CanvasSettings().radius; project.edits.canvas?.shadow = CanvasSettings().shadow
        let again = try await image(project); assert(imageBytes(browser) == imageBytes(again), "Canvas/follow zoom seek is not deterministic after speed/cuts")
        try NSBitmapImageRep(cgImage: browser).representation(using: .png, properties: [:])!.write(to: directory.appendingPathComponent("canvas-browser.png"))
        try JSONEncoder().encode(cursor).write(to: directory.appendingPathComponent("media/follow.json"))
        var moving = project; moving.source?.cursor = "media/follow.json"
        let movingComposition = try await makeComposition(moving, directory: directory.path), movingGenerator = AVAssetImageGenerator(asset: movingComposition.composition)
        movingGenerator.videoComposition = movingComposition.video; movingGenerator.requestedTimeToleranceBefore = .zero; movingGenerator.requestedTimeToleranceAfter = .zero
        let focused = try await movingGenerator.image(at: mediaTime(450)).image
        _ = try await movingGenerator.image(at: mediaTime(1800))
        let focusedAgain = try await movingGenerator.image(at: mediaTime(450)).image
        moving.edits.zooms[0].followCursor = false
        let staticFocus = try await image(moving, at: 450)
        assert(imageBytes(focused) == imageBytes(focusedAgain) && imageBytes(focused) != imageBytes(staticFocus), "Follow zoom did not move deterministically with the recorded pointer")
        project.edits.canvas?.aspectRatio = "9:16"
        let path = directory.appendingPathComponent("portrait-speed.mp4").path
        _ = try await NativeApp.shared.command("export.start", ["project": try jsonObject(project), "projectDir": directory.path, "path": path, "width": 2160, "height": 3840, "jobId": "portrait-speed"])
        for _ in 0..<600 {
            let job = try await NativeApp.shared.command("export.status", ["jobId": "portrait-speed"]) as! [String: Any]
            if job["status"] as? String == "completed" { break }
            if job["status"] as? String == "failed" { throw NativeFailure("Portrait export failed: \(job)") }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        let info = try await NativeApp.shared.inspectMedia(path)
        assert(info["width"] as? Int == 2160 && info["height"] as? Int == 3840 && abs((info["durationMs"] as! Double) - 2500) < 100)
        let fastPitch = try await tonePitch(URL(fileURLWithPath: path), fromMs: 100, toMs: 400)
        let slowPitch = try await tonePitch(URL(fileURLWithPath: path), fromMs: 800, toMs: 1500)
        let endPitch = try await tonePitch(URL(fileURLWithPath: path), fromMs: 2100, toMs: 2350)
        assert(abs(fastPitch - 440) < 20 && abs(slowPitch - 440) < 20 && abs(endPitch - 440) < 20, "Playback speed changed audio pitch: \(fastPitch), \(slowPitch), \(endPitch)Hz")
        let audioAsset = AVURLAsset(url: URL(fileURLWithPath: path)), audioTrack = try await audioAsset.loadTracks(withMediaType: .audio).first!
        let audioRange = try await audioTrack.load(.timeRange)
        assert(abs(milliseconds(audioRange.end) - 2500) < 150, "Exported audio was truncated after a rate transition")
        // Repeated transitions and reusing a rate after gaps exercise AVFoundation's processor state.
        var repeating = project; repeating.source?.systemAudio = project.source?.microphone
        repeating.edits.segments += project.edits.segments
        assert(sourceTime(repeating.edits.segments, 3000) == 2000 && timelineDuration(repeating.edits.segments) == 5000)
        for iteration in 1...2 {
            let repeatID = "rate-repeat-\(iteration)", repeatPath = directory.appendingPathComponent("rate-repeat-\(iteration).mp4").path
            _ = try await NativeApp.shared.command("export.start", ["project": try jsonObject(repeating), "projectDir": directory.path, "path": repeatPath, "width": 360, "height": 640, "jobId": repeatID])
            for _ in 0..<300 {
                let job = try await NativeApp.shared.command("export.status", ["jobId": repeatID]) as! [String: Any]
                if job["status"] as? String == "completed" { break }
                if job["status"] as? String == "failed" { throw NativeFailure("Repeated speed export failed: \(job)") }
                try await Task.sleep(nanoseconds: 100_000_000)
            }
            for (start, end) in [(100.0, 400.0), (800, 1500), (2600, 2900), (3300, 4000), (4600, 4850)] {
                let pitch = try await tonePitch(URL(fileURLWithPath: repeatPath), fromMs: start, toMs: end)
                assert(abs(pitch - 440) < 20, "A repeated rate transition lost audio at \(start)ms: \(pitch)Hz")
            }
            let asset = AVURLAsset(url: URL(fileURLWithPath: repeatPath)), track = try await asset.loadTracks(withMediaType: .audio).first!, range = try await track.load(.timeRange)
            assert(abs(milliseconds(range.end) - 5000) < 150)
        }
        let exportGenerator = AVAssetImageGenerator(asset: AVURLAsset(url: URL(fileURLWithPath: path))); exportGenerator.requestedTimeToleranceBefore = .zero; exportGenerator.requestedTimeToleranceAfter = .zero
        let reference = try await makeComposition(project, directory: directory.path, width: 2160, height: 3840), referenceGenerator = AVAssetImageGenerator(asset: reference.composition)
        referenceGenerator.videoComposition = reference.video; referenceGenerator.requestedTimeToleranceBefore = .zero; referenceGenerator.requestedTimeToleranceAfter = .zero
        let encoded = try await exportGenerator.image(at: mediaTime(800)).image, expected = try await referenceGenerator.image(at: mediaTime(800)).image
        for (x, y) in [(100, 100), (1080, 1920), (2000, 3700)] { assertVisualMatch(encoded, expected, x: x, y: y, label: "Portrait preview/export") }
        project.edits.segments = [MediaRange(startMs: 0, endMs: 200)]
        for width in [16, 32] {
        let narrowPath = directory.appendingPathComponent("narrow-\(width).mp4").path, jobID = "narrow-\(width)"
        _ = try await NativeApp.shared.command("export.start", ["project": try jsonObject(project), "projectDir": directory.path, "path": narrowPath, "width": width, "height": 1080, "jobId": jobID])
        for _ in 0..<200 {
            let job = try await NativeApp.shared.command("export.status", ["jobId": jobID]) as! [String: Any]
            if job["status"] as? String == "completed" { break }
            if job["status"] as? String == "failed" { throw NativeFailure("Narrow export failed: \(job)") }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        let narrow = try await NativeApp.shared.inspectMedia(narrowPath)
        assert(narrow["width"] as? Int == width && narrow["height"] as? Int == 1080)
        }
    }
    static func renderMetricChecks() {
        let metrics = PreviewRenderMetrics(), started = ProcessInfo.processInfo.systemUptime - 0.005
        metrics.begin(id: "current", kind: "update", started: started, inputAtMs: Date().timeIntervalSince1970 * 1000 - 50)
        metrics.finish(id: "previous", timeMs: 200)
        assert(metrics.snapshot()["count"] as? Int == 0)
        metrics.finish(id: "current", timeMs: 200)
        let sample = (metrics.snapshot()["samples"] as! [[String: Any]])[0]
        assert((sample["latencyMs"] as! Double) >= 5 && (sample["inputLatencyMs"] as! Double) >= 50)
        metrics.begin(id: "seek", kind: "seek", started: started, targetMs: 1000, inputAtMs: .infinity)
        metrics.finish(id: "seek", timeMs: 200); assert(metrics.snapshot()["count"] as? Int == 1)
        metrics.finish(id: "seek", timeMs: 1000); assert(metrics.snapshot()["inputCount"] as? Int == 1)
        for _ in 0..<1005 { metrics.begin(id: "bounded", kind: "update", started: started); metrics.finish(id: "bounded", timeMs: 0) }
        assert(metrics.snapshot()["count"] as? Int == 1000)
        assert(metrics.snapshot(reset: true)["count"] as? Int == 0)
    }
    static func cameraLayoutChecks(_ original: Project) throws {
        var project = original
        project.edits.camera.hiddenRanges = []
        project.edits.camera.layouts = [CameraLayout(id: "range", startMs: 500, endMs: 3500, shape: "square", x: 0.1, y: 0.2, size: 0.3, shadow: false)]
        let runs = cameraOutputRuns(project), base = CameraVisual(project.edits.camera)
        assert(runs.count == 3 && runs[1].startMs == 500 && runs[1].endMs == 2500, "Camera layout did not join across a source cut")
        let inside = cameraVisual(runs, at: 1000, fallback: base)
        assert(inside.x == 0.1 && inside.size == 0.3, "Cut restarted the camera transition")
        let before = cameraVisual(runs, at: 350, fallback: base), middle = cameraVisual(runs, at: 500, fallback: base), after = cameraVisual(runs, at: 650, fallback: base)
        assert(before.x == base.x && abs(middle.x - (base.x + 0.1) / 2) < 0.00001 && after.x == 0.1)
        project.edits.segments = [MediaRange(startMs: 0, endMs: 1000, speed: 2), MediaRange(startMs: 2000, endMs: 4000, speed: 0.5)]
        let sped = cameraOutputRuns(project)
        assert(sped[1].startMs == 250 && sped[1].endMs == 3500)
        project.edits.camera.layouts?.append(CameraLayout(id: "next", startMs: 3500, endMs: 3550, shape: "circle", x: 0.5, y: 0.6, size: 0.2, shadow: true))
        let short = cameraOutputRuns(project)
        let midpoint = cameraVisual(short, at: 3500, fallback: base)
        assert(abs(midpoint.x - 0.3) < 0.0001, "Adjacent layouts did not share one shortened transition")
        project.edits.camera.layouts = []
        assert(cameraOutputRuns(project).count == 1)
    }
    @MainActor static func livePreviewChecks(_ original: Project, directory: URL) async throws {
        let app = NativeApp.shared
        let window = NSWindow(contentRect: CGRect(x: 0, y: 0, width: 800, height: 600), styleMask: [.titled], backing: .buffered, defer: false)
        app.attach(window)
        var project = original; project.edits.camera.hiddenRanges = []; project.edits.zooms = []; project.edits.overlays = []; project.edits.captions.enabled = false
        _ = try await app.command("preview.load", ["project": try jsonObject(project), "projectDir": directory.path, "revision": 4])
        _ = try await app.command("preview.seek", ["timeMs": 800])
        let item = app.player!.currentItem!, itemID = app.previewItemID
        let media = app.previewBuilt!.composition, priorVideo = item.videoComposition
        project.edits.camera.x = 0.1
        _ = try await app.command("preview.update", ["project": try jsonObject(project), "projectDir": directory.path, "revision": 4, "sequence": 2])
        assert(app.player?.currentItem === item && app.previewBuilt?.composition === media && app.previewItemID == itemID, "Property edit rebuilt the player or media")
        assert(item.videoComposition !== priorVideo && item.videoComposition != nil, "Paused property edit did not replace render instructions")
        assert(abs(milliseconds(app.player!.currentTime()) - 800) < 34)
        let geometry = try await app.command("preview.geometry", ["timeMs": 800]) as! [String: Any]
        let camera = (geometry["items"] as! [[String: Any]]).first { $0["kind"] as? String == "camera" }!
        assert(abs((camera["x"] as! Double) - 0.1) < 0.00001)
        _ = try await app.command("preview.bounds", ["x": 20, "y": 20, "width": 640, "height": 360])
        _ = try await app.command("preview.selection", ["selection": ["kind": "camera"]])
        assert(app.preview?.selectionLayer.path != nil && app.preview?.handlesLayer.path != nil)
        var stale = project; stale.edits.camera.x = 0.6
        _ = try await app.command("preview.update", ["project": try jsonObject(stale), "projectDir": directory.path, "revision": 4, "sequence": 1])
        assert(app.previewProject?.edits.camera.x == 0.1, "Out-of-order gesture applied")
        _ = try await app.command("preview.update", ["project": try jsonObject(stale), "projectDir": directory.path, "revision": 3, "sequence": 100])
        assert(app.previewProject?.edits.camera.x == 0.1, "Old revision applied")
        // `async let` children may enter the actor in any order. Signal each entry before
        // launching its successor so "latest" means the last submitted seek, not source order.
        func startSeek(_ time: Double) async -> Task<Void, Never> {
            var task: Task<Void, Never>!
            await withCheckedContinuation { (entered: CheckedContinuation<Void, Never>) in
                task = Task { @MainActor in
                    entered.resume()
                    await app.seek(mediaTime(time))
                }
            }
            return task
        }
        for _ in 0..<10 {
            let first = await startSeek(200), second = await startSeek(1800)
            await app.seek(mediaTime(2400))
            await first.value; await second.value
            let actual = milliseconds(app.player!.currentTime())
            assert(abs(actual - 2400) < 34 && !app.seeking, "Chase seek did not finish at latest target: \(actual)ms")
        }
        project.edits.overlays = original.edits.overlays
        _ = try await app.command("preview.load", ["project": try jsonObject(project), "projectDir": directory.path])
        let overlayGeometry = app.previewGeometry(at: 2400)["items"] as! [[String: Any]]
        let overlay = overlayGeometry.first { $0["id"] as? String == "text" }!
        let instruction = app.previewBuilt!.instruction, bounds = CGRect(origin: .zero, size: app.previewBuilt!.video.renderSize)
        let rectangle = overlayRect(project.edits.overlays[0], sourceMs: 3400, bounds: bounds, images: instruction.images)
        assert(abs((overlay["height"] as! Double) * bounds.height - rectangle.height) < 0.0001, "Text handle measurements diverged from compositor")
        _ = try await app.command("preview.selection", ["selection": NSNull()])
        assert(app.preview?.selectionLayer.path == nil)
        _ = app.previewMetrics.snapshot(reset: true)
        for index in 0..<25 {
            project.edits.camera.x = 0.1 + Double(index % 10) * 0.04
            _ = try await app.command("preview.update", ["project": try jsonObject(project), "projectDir": directory.path, "sequence": index + 1])
            for _ in 0..<500 {
                if (app.previewMetrics.snapshot()["count"] as? Int ?? 0) > index { break }
                try await Task.sleep(nanoseconds: 2_000_000)
            }
            assert((app.previewMetrics.snapshot()["count"] as? Int ?? 0) > index, "Paused update did not produce a new composited frame")
        }
        let metrics = app.previewMetrics.snapshot()
        project.edits.camera.layouts = [CameraLayout(id: "layout", startMs: 500, endMs: 3500, shape: "square", x: 0.1, y: 0.2, size: 0.3, shadow: false)]
        _ = try await app.command("preview.update", ["project": try jsonObject(project), "projectDir": directory.path, "sequence": 30])
        let layoutBuilt = app.previewBuilt!, layoutGenerator = AVAssetImageGenerator(asset: layoutBuilt.composition)
        layoutGenerator.videoComposition = layoutBuilt.video
        layoutGenerator.requestedTimeToleranceBefore = .zero; layoutGenerator.requestedTimeToleranceAfter = .zero
        let layoutFrame = try await layoutGenerator.image(at: mediaTime(800)).image
        let cameraBox = cameraRect(cameraVisual(layoutBuilt.instruction.cameraRuns, at: 800, fallback: CameraVisual(project.edits.camera)), bounds: CGRect(origin: .zero, size: layoutBuilt.video.renderSize))
        let layoutPixel = pixel(layoutFrame, x: Int(cameraBox.midX), y: Int(layoutBuilt.video.renderSize.height - cameraBox.midY))
        assert(layoutPixel[1] > layoutPixel[0] + 80, "Camera range layout did not affect rendered pixels")
        try JSONSerialization.data(withJSONObject: metrics, options: [.prettyPrinted, .sortedKeys]).write(to: directory.appendingPathComponent("preview-metrics.json"))
        print("Native paused-update latency (\(project.source!.width)×\(project.source!.height), command arrival to compositor completion, 25 samples): p95=\(metrics["p95Ms"]!)ms")
        let beforeCut = app.previewItemID
        project.edits.segments = [MediaRange(startMs: 0, endMs: 2000)]
        _ = try await app.command("preview.update", ["project": try jsonObject(project), "projectDir": directory.path, "revision": 1])
        assert(app.previewItemID != beforeCut && abs(milliseconds(app.previewBuilt!.composition.duration) - 2000) < 1, "Structural edit reused incompatible media tracks")
        assert(milliseconds(app.player!.currentTime()) <= 2000 && milliseconds(app.player!.currentTime()) >= 1933, "Cut preview did not clamp the old playhead to the remaining timeline")
        var newest = project; newest.edits.camera.x = 0.22
        let update = Task { @MainActor in try await app.command("preview.update", ["project": try jsonObject(newest), "projectDir": directory.path, "revision": 1, "sequence": 20]) }
        await Task.yield()
        _ = try await app.command("preview.update", ["project": try jsonObject(project), "projectDir": directory.path, "revision": 1, "sequence": 19])
        _ = try await update.value
        assert(app.previewProject?.edits.camera.x == 0.22, "An older async update superseded a newer gesture")
        var unsupported = project; unsupported.schemaVersion = 99
        do { _ = try await makeComposition(unsupported, directory: directory.path); assertionFailure("Unsupported project version accepted") }
        catch { assert((error as? NativeFailure)?.code == "unsupported_version") }
    }
    static func tonePitch(_ url: URL, fromMs: Double, toMs: Double) async throws -> Double {
        let (reader, output) = try await audioReader(url)
        var previous: Int16 = 0, crossings = 0, count = 0
        while let sample = output.copyNextSampleBuffer() {
            let data = try pcmData(sample), start = milliseconds(sample.presentationTimeStamp)
            data.withUnsafeBytes { raw in
                for (index, value) in raw.bindMemory(to: Int16.self).enumerated() {
                    let t = start + Double(index) / 16; guard t >= fromMs && t < toMs else { continue }
                    let value = Int16(littleEndian: value); if previous <= 0 && value > 0 { crossings += 1 }; previous = value; count += 1
                }
            }
        }
        if reader.status == .failed { throw reader.error ?? NativeFailure("Exported audio could not be decoded") }
        return Double(crossings) / (Double(count) / 16000)
    }
    static func syntheticAudio() -> Data {
        var data = Data()
        for index in 0..<(16000 * 4) { let amplitude = (index / 16000) % 2 == 0 ? sin(Double(index) * 2 * .pi * 440 / 16000) * 8000 : 0; var value = Int16(amplitude).littleEndian; withUnsafeBytes(of: &value) { data.append(contentsOf: $0) } }; return data
    }
    static func syntheticVideo(_ url: URL, camera: Bool, height: Int = 360, width: Int = 640) async throws {
        let writer = try AVAssetWriter(outputURL: url, fileType: .mov)
        let input = AVAssetWriterInput(mediaType: .video, outputSettings: [AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: width, AVVideoHeightKey: height])
        let adapter = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA, kCVPixelBufferWidthKey as String: width, kCVPixelBufferHeightKey as String: height])
        writer.add(input); guard writer.startWriting() else { throw writer.error! }; writer.startSession(atSourceTime: .zero)
        let context = CIContext()
        for i in 0..<120 {
            while !input.isReadyForMoreMediaData { try await Task.sleep(nanoseconds: 2_000_000) }
            var buffer: CVPixelBuffer?; CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, adapter.pixelBufferPool!, &buffer)
            let bounds = CGRect(x: 0, y: 0, width: width, height: height)
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
    static func meanPixel(_ image: CGImage, x: Int, y: Int, radius: Int = 2) -> [Int] {
        var totals = [Int](repeating: 0, count: 3), count = 0
        for sampleY in max(0, y - radius)...min(image.height - 1, y + radius) {
            for sampleX in max(0, x - radius)...min(image.width - 1, x + radius) {
                let value = pixel(image, x: sampleX, y: sampleY)
                for channel in 0..<3 { totals[channel] += value[channel] }
                count += 1
            }
        }
        return totals.map { $0 / count }
    }
    static func assertVisualMatch(_ first: CGImage, _ second: CGImage, x: Int, y: Int, label: String) {
        let a = meanPixel(first, x: x, y: y), b = meanPixel(second, x: x, y: y)
        let differences = zip(a, b).map { abs($0 - $1) }
        // H.264 color conversion varies across VideoToolbox implementations, especially on virtual CI GPUs.
        // Spatial or compositing regressions still exceed both the average and per-channel bounds below.
        assert(differences.reduce(0, +) / differences.count < 24 && differences.max()! < 64, "\(label) mismatch \(a), \(b), channel differences \(differences)")
    }
}
