@preconcurrency import AVFoundation
import CoreMedia

final class TrackWriter {
    let writer: AVAssetWriter; let input: AVAssetWriterInput; let video: Bool
    var lastVideo: CMSampleBuffer?; var samples = 0
    init(url: URL, videoSize: CGSize? = nil) throws {
        video = videoSize != nil
        writer = try AVAssetWriter(outputURL: url, fileType: .mov)
        writer.initialMovieFragmentInterval = CMTime(seconds: 1, preferredTimescale: 600)
        writer.movieFragmentInterval = CMTime(seconds: 10, preferredTimescale: 600)
        if let size = videoSize {
            input = AVAssetWriterInput(mediaType: .video, outputSettings: [AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: Int(size.width), AVVideoHeightKey: Int(size.height), AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: Int(size.width * size.height * 4), AVVideoExpectedSourceFrameRateKey: 30, AVVideoMaxKeyFrameIntervalKey: 60]])
        } else {
            input = AVAssetWriterInput(mediaType: .audio, outputSettings: [AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: 48000, AVNumberOfChannelsKey: 2, AVEncoderBitRateKey: 192000])
        }
        input.expectsMediaDataInRealTime = true
        guard writer.canAdd(input) else { throw NativeFailure("Encoder cannot create requested track.") }
        writer.add(input)
        guard writer.startWriting() else { throw writer.error ?? NativeFailure("Encoder failed to start.") }
        writer.startSession(atSourceTime: .zero)
    }
    func append(_ sample: CMSampleBuffer) throws {
        if writer.status == .failed { throw writer.error ?? NativeFailure("Recording writer failed.") }
        guard input.isReadyForMoreMediaData else { if !video { throw NativeFailure("Audio encoder cannot keep up; recording stopped to preserve synchronization.") }; return }
        guard input.append(sample) else { throw writer.error ?? NativeFailure("Could not append media sample.") }
        samples += 1; if video { lastVideo = sample }
    }
    func finish(at time: CMTime) async throws {
        if video, let last = lastVideo, time > last.presentationTimeStamp, input.isReadyForMoreMediaData {
            var timing = CMSampleTimingInfo(duration: CMTime(value: 1, timescale: 30), presentationTimeStamp: time, decodeTimeStamp: .invalid)
            var copy: CMSampleBuffer?
            if CMSampleBufferCreateCopyWithNewTiming(allocator: kCFAllocatorDefault, sampleBuffer: last, sampleTimingEntryCount: 1, sampleTimingArray: &timing, sampleBufferOut: &copy) == noErr, let copy { _ = input.append(copy) }
        }
        writer.endSession(atSourceTime: time); input.markAsFinished()
        await writer.finishWriting()
        if writer.status == .failed { throw writer.error ?? NativeFailure("Recording file could not be finalized.") }
    }
}
