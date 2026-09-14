import AppKit
import AVFoundation
import CoreImage
import CoreText

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
