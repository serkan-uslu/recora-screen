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
    struct ClipStructure: Encodable { let id: String; let assetId: String; let startMs: Double; let endMs: Double; let offsetMs: Double }
    struct Structure: Encodable { let id: String; let directory: String; let source: RecordingSource?; let segments: [MediaRange]; let clips: [ClipStructure]; let mediaAssets: [MediaAsset] }
    let clips = (project.edits.audioClips ?? []).map { ClipStructure(id: $0.id, assetId: $0.assetId, startMs: $0.startMs, endMs: $0.endMs, offsetMs: $0.offsetMs) }
    return try encoder.encode(Structure(id: project.id, directory: directory, source: project.source, segments: project.edits.segments, clips: clips, mediaAssets: project.assets.filter { asset in asset.kind == "audio" || project.edits.segments.contains(where: { $0.assetId == asset.id }) }))
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
    let instruction = RenderInstruction(project: project, duration: old.timeRange.duration, screenID: old.screenID, cameraID: old.cameraID, cursor: old.interactions, directory: old.directory, images: images, transforms: old.transforms, mediaTransforms: old.mediaTransforms, mediaSizes: old.mediaSizes, previous: old)
    let video = try videoComposition(project, instruction: instruction)
    let audio = AVMutableAudioMix()
    audio.inputParameters = previous.audioKinds.map { id, kind in
        let parameter = AVMutableAudioMixInputParameters(); parameter.trackID = id
        parameter.setVolume(Float(max(0, min(2, kind.hasPrefix("clip:") ? (project.edits.audioClips?.first { "clip:" + $0.id == kind }?.volume ?? 0) : kind == "microphone" ? project.edits.audio.microphoneVolume : project.edits.audio.systemVolume))), at: .zero)
        parameter.audioTimePitchAlgorithm = .spectral; return parameter
    }
    return BuiltComposition(composition: previous.composition, video: video, audio: audio, audioKinds: previous.audioKinds)
}

func validateCompositionProject(_ project: Project) throws {
    guard let source = project.source, source.durationMs > 0, !project.edits.segments.isEmpty else { throw NativeFailure("Project has no recorded timeline.", code: "empty_project") }
    guard project.schemaVersion == 1 || project.schemaVersion == 2 else { throw NativeFailure("This project format is not supported by this version.", code: "unsupported_version") }
    guard project.edits.segments.count <= 10000, project.edits.segments.allSatisfy({ range in
        guard range.startMs.isFinite, range.endMs.isFinite, range.startMs >= 0, range.endMs > range.startMs, range.rate.isFinite, range.rate >= 0.25, range.rate <= 8 else { return false }
        guard let id = range.assetId else { return range.endMs <= source.durationMs + 1 }
        guard let asset = project.assets.first(where: { $0.id == id }) else { return false }
        if asset.kind == "image" { return range.endMs <= 60_000 }
        return asset.kind == "video" && asset.durationMs.map { $0.isFinite && $0 > 0 && range.endMs <= $0 + 1 } == true
    }) else { throw NativeFailure("Invalid timeline media, ranges or playback speed.", code: "invalid_project") }

}
func makeComposition(_ project: Project, directory: String, width: Int? = nil, height: Int? = nil) async throws -> BuiltComposition {
    try validateCompositionProject(project)
    let source = project.source!
    let composition = AVMutableComposition()
    var transforms: [CMPersistentTrackID: CGAffineTransform] = [:], mediaTransforms: [String: CGAffineTransform] = [:], mediaSizes: [String: CGSize] = [:]
    var videoIDs: [String: CMPersistentTrackID] = [:], audioParameters: [AVMutableAudioMixInputParameters] = []
    var audioKinds: [CMPersistentTrackID: String] = [:]
    let originalAsset = AVURLAsset(url: try projectURL(directory, source.screen))
    guard let original = try await originalAsset.loadTracks(withMediaType: .video).first,
          let screen = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid) else { throw NativeFailure("Screen video is missing.") }
    videoIDs["screen"] = screen.trackID; transforms[screen.trackID] = try await original.load(.preferredTransform)
    let originalRange = try await original.load(.timeRange)
    guard originalRange.duration > .zero else { throw NativeFailure("Screen video is empty.", code: "invalid_media") }
    var inputs: [String: AVAssetTrack] = [:], videoAudio: [String: AVAssetTrack] = [:]
    // AVAssetTrack.asset is weak; retain imports until both video and embedded audio have been inserted.
    var importedAssets: [AVURLAsset] = []
    defer { withExtendedLifetime(importedAssets) {} }
    var position = CMTime.zero
    for range in project.edits.segments {
        try Task.checkCancellation()
        var input = original
        var requested = CMTimeRange(start: mediaTime(range.startMs), end: mediaTime(range.endMs))
        if let id = range.assetId, let media = project.assets.first(where: { $0.id == id }) {
            if media.kind == "image" {
                // A single source frame drives AVFoundation's video clock; the compositor replaces it with the still.
                requested = CMTimeRange(start: originalRange.start, duration: min(originalRange.duration, mediaTime(1000 / 30)))
            } else {
                if let cached = inputs[id] { input = cached }
                else {
                    let asset = AVURLAsset(url: try projectURL(directory, media.path)); importedAssets.append(asset)
                    guard let video = try await asset.loadTracks(withMediaType: .video).first else { throw NativeFailure("Inserted video track is missing.", code: "invalid_media") }
                    input = video; inputs[id] = video
                    let transform = try await video.load(.preferredTransform), size = try await video.load(.naturalSize).applying(transform)
                    mediaTransforms[id] = transform; mediaSizes[id] = CGSize(width: abs(size.width), height: abs(size.height))
                    videoAudio[id] = try await asset.loadTracks(withMediaType: .audio).first
                }
            }
        }
        let available = try await input.load(.timeRange), intersection = CMTimeRangeGetIntersection(requested, otherRange: available)
        guard intersection.isValid, intersection.duration > .zero else { throw NativeFailure("Timeline clip has no playable video.", code: "invalid_media") }
        if range.assetId != nil, project.assets.first(where: { $0.id == range.assetId })?.kind == "video", milliseconds(available.end) + 1 < range.endMs { throw NativeFailure("Inserted clip exceeds its video file.", code: "invalid_project") }
        let duration = mediaTime(range.outputDuration)
        try screen.insertTimeRange(intersection, of: input, at: position)
        screen.scaleTimeRange(CMTimeRange(start: position, duration: intersection.duration), toDuration: duration)
        position = position + duration
    }
    // Each audio source/rate uses one track to keep AVFoundation's pitch processor stable across cuts.
    func addTrack(_ input: AVAssetTrack, kind: String, type: AVMediaType, volume: Double, assetID: String? = nil) async throws {
        var outputs: [Double: AVMutableCompositionTrack] = [:]
        let available = try await input.load(.timeRange)
        var position = CMTime.zero
        for range in project.edits.segments {
            try Task.checkCancellation()
            defer { position = position + mediaTime(range.outputDuration) }
            guard range.assetId == assetID else { continue }
            let requested = CMTimeRange(start: mediaTime(range.startMs), end: mediaTime(range.endMs))
            let intersection = CMTimeRangeGetIntersection(requested, otherRange: available)
            guard intersection.isValid, intersection.duration > .zero else { continue }
            let key = type == .audio ? range.rate : 0
            let output: AVMutableCompositionTrack
            if let existing = outputs[key] { output = existing }
            else { guard let created = composition.addMutableTrack(withMediaType: type, preferredTrackID: kCMPersistentTrackID_Invalid) else { throw NativeFailure("Could not create media track.") }; outputs[key] = created; output = created }
            let start = position + CMTimeMultiplyByFloat64(intersection.start - requested.start, multiplier: 1 / range.rate)
            try output.insertTimeRange(intersection, of: input, at: start)
            if range.rate != 1 { output.scaleTimeRange(CMTimeRange(start: start, duration: intersection.duration), toDuration: CMTimeMultiplyByFloat64(intersection.duration, multiplier: 1 / range.rate)) }
        }
        if type == .video, let output = outputs[0] { videoIDs[kind] = output.trackID; transforms[output.trackID] = try await input.load(.preferredTransform) }
        else { for output in outputs.values { let p = AVMutableAudioMixInputParameters(track: output); p.setVolume(Float(max(0, min(2, volume))), at: .zero); p.audioTimePitchAlgorithm = .spectral; audioParameters.append(p); audioKinds[output.trackID] = kind } }
    }
    for (kind, path, type, volume) in [("camera", source.camera, AVMediaType.video, 1.0), ("microphone", source.microphone, .audio, project.edits.audio.microphoneVolume), ("systemAudio", source.systemAudio, .audio, project.edits.audio.systemVolume)] {
        guard let path else { continue }
        let asset = AVURLAsset(url: try projectURL(directory, path))
        if let input = try await asset.loadTracks(withMediaType: type).first { try await addTrack(input, kind: kind, type: type, volume: volume) }
    }
    for (id, input) in videoAudio { try await addTrack(input, kind: "video:" + id, type: .audio, volume: project.edits.audio.systemVolume, assetID: id) }
    // Imported audio is anchored to output time and does not change pitch with screen speed edits.
    let outputEnd = timelineDuration(project.edits.segments)
    for clip in project.edits.audioClips ?? [] {
        try Task.checkCancellation()
        guard clip.startMs.isFinite, clip.endMs.isFinite, clip.offsetMs.isFinite, clip.volume.isFinite, clip.startMs >= 0, clip.endMs > clip.startMs, clip.offsetMs >= 0, clip.volume >= 0, clip.volume <= 2,
              let media = project.assets.first(where: { $0.id == clip.assetId && $0.kind == "audio" }) else { throw NativeFailure("Invalid imported audio clip.", code: "invalid_project") }
        let asset = AVURLAsset(url: try projectURL(directory, media.path))
        guard let input = try await asset.loadTracks(withMediaType: .audio).first else { throw NativeFailure("Imported audio track is missing.", code: "invalid_media") }
        let available = try await input.load(.timeRange)
        guard clip.offsetMs + clip.endMs - clip.startMs <= milliseconds(available.duration) + 1 else { throw NativeFailure("Audio clip exceeds its source file.", code: "invalid_project") }
        let length = min(clip.endMs, outputEnd) - clip.startMs
        if length <= 0 { continue }
        guard let output = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) else { throw NativeFailure("Could not create audio track.") }
        try output.insertTimeRange(CMTimeRange(start: available.start + mediaTime(clip.offsetMs), duration: mediaTime(length)), of: input, at: mediaTime(clip.startMs))
        let parameter = AVMutableAudioMixInputParameters(track: output); parameter.setVolume(Float(clip.volume), at: .zero)
        audioParameters.append(parameter); audioKinds[output.trackID] = "clip:" + clip.id
    }
    guard let screenID = videoIDs["screen"] else { throw NativeFailure("Screen track unavailable.") }
    let duration = mediaTime(timelineDuration(project.edits.segments))
    var cursor: [CursorEvent] = []
    if let path = source.cursor, let data = try? Data(contentsOf: projectURL(directory, path)) { cursor = readCursor(data) }
    var images: [String: CIImage] = [:]
    for asset in project.assets where asset.kind == "image" { images[asset.id] = CIImage(contentsOf: try projectURL(directory, asset.path), options: [.applyOrientationProperty: true]) }
    for range in project.edits.segments { if let id = range.assetId, project.assets.first(where: { $0.id == id })?.kind == "image", images[id] == nil { throw NativeFailure("Inserted image cannot be read.", code: "invalid_media") } }
    let instruction = RenderInstruction(project: project, duration: duration, screenID: screenID, cameraID: videoIDs["camera"], cursor: cursor, directory: directory, images: images, transforms: transforms, mediaTransforms: mediaTransforms, mediaSizes: mediaSizes)
    let video = try videoComposition(project, instruction: instruction, width: width, height: height)
    let audio = AVMutableAudioMix(); audio.inputParameters = audioParameters
    return BuiltComposition(composition: composition, video: video, audio: audio, audioKinds: audioKinds)
}
