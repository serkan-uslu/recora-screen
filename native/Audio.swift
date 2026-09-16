import Foundation
import AVFoundation

func audioReader(_ url: URL, timeRange: CMTimeRange? = nil) async throws -> (AVAssetReader, AVAssetReaderTrackOutput) {
    let asset = AVURLAsset(url: url)
    guard let track = try await asset.loadTracks(withMediaType: .audio).first else { throw NativeFailure("Media has no audio track.", code: "audio_unavailable") }
    let reader = try AVAssetReader(asset: asset)
    let output = AVAssetReaderTrackOutput(track: track, outputSettings: [AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: 16000, AVNumberOfChannelsKey: 1, AVLinearPCMBitDepthKey: 16, AVLinearPCMIsFloatKey: false, AVLinearPCMIsBigEndianKey: false, AVLinearPCMIsNonInterleaved: false])
    output.alwaysCopiesSampleData = false
    guard reader.canAdd(output) else { throw NativeFailure("Audio decoding unsupported.") }; reader.add(output)
    if let timeRange { reader.timeRange = timeRange }
    guard reader.startReading() else { throw reader.error ?? NativeFailure("Could not decode audio.") }
    return (reader, output)
}
func pcmData(_ sample: CMSampleBuffer) throws -> Data {
    guard let block = CMSampleBufferGetDataBuffer(sample) else { throw NativeFailure("Audio buffer missing.") }
    let length = CMBlockBufferGetDataLength(block); var data = Data(count: length)
    let status = data.withUnsafeMutableBytes { CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: length, destination: $0.baseAddress!) }
    guard status == noErr else { throw NativeFailure("Audio buffer could not be read.") }; return data
}
func analyzeAudio(_ url: URL) async throws -> [[String: Double]] {
    let (reader, output) = try await audioReader(url)
    return try await Task.detached(priority: .utility) {
        var bins: [[String: Double]] = [], sum = 0.0, count = 0, start = 0.0, previousEnd = 0.0
        func flush() {
            guard count > 0 else { return }
            bins.append(["startMs": start, "endMs": start + Double(count) / 16, "db": max(-120, 20 * log10(max(0.000001, sqrt(sum / Double(count)))))])
            count = 0; sum = 0
        }
        while let sample = output.copyNextSampleBuffer() {
            let data = try pcmData(sample), pts = milliseconds(sample.presentationTimeStamp)
            if abs(pts - previousEnd) > 2 { flush() }
            data.withUnsafeBytes { raw in
                let values = raw.bindMemory(to: Int16.self)
                for (index, value) in values.enumerated() {
                    if count == 0 { start = pts + Double(index) / 16 }
                    let x = Double(Int16(littleEndian: value)) / 32768; sum += x * x; count += 1
                    if count == 320 { flush() }
                }
                previousEnd = pts + Double(values.count) / 16
            }
        }
        flush(); if reader.status == .failed { throw reader.error ?? NativeFailure("Audio analysis failed.") }; return bins
    }.value
}
func audioWaveform(_ url: URL, startMs: Double, endMs: Double) async throws -> [Double] {
    let range = CMTimeRange(start: mediaTime(startMs), end: mediaTime(endMs))
    let reader: AVAssetReader, output: AVAssetReaderTrackOutput
    do { (reader, output) = try await audioReader(url, timeRange: range) }
    catch let error as NativeFailure where error.code == "audio_unavailable" { return [] }
    return try await Task.detached(priority: .utility) {
        let bins = 256, width = (endMs - startMs) / Double(bins)
        var sums = [Double](repeating: 0, count: bins), counts = [Int](repeating: 0, count: bins)
        while let sample = output.copyNextSampleBuffer() {
            try Task.checkCancellation()
            let data = try pcmData(sample), pts = milliseconds(sample.presentationTimeStamp)
            data.withUnsafeBytes { raw in
                for (index, sample) in raw.bindMemory(to: Int16.self).enumerated() {
                    let position = Int(floor((pts + Double(index) / 16 - startMs) / width))
                    guard position >= 0, position < bins else { continue }
                    let value = Double(Int16(littleEndian: sample)) / 32768
                    sums[position] += value * value; counts[position] += 1
                }
            }
        }
        if reader.status == .failed { throw reader.error ?? NativeFailure("Waveform decoding failed.") }
        return (0..<bins).map { counts[$0] > 0 ? min(1, sqrt(sums[$0] / Double(counts[$0]))) : 0 }
    }.value
}

func wavHeader(_ bytes: UInt32) -> Data {
    var data = Data()
    func text(_ value: String) { data.append(contentsOf: value.utf8) }
    func u32(_ value: UInt32) { var v = value.littleEndian; withUnsafeBytes(of: &v) { data.append(contentsOf: $0) } }
    func u16(_ value: UInt16) { var v = value.littleEndian; withUnsafeBytes(of: &v) { data.append(contentsOf: $0) } }
    text("RIFF"); u32(bytes + 36); text("WAVEfmt "); u32(16); u16(1); u16(1); u32(16000); u32(32000); u16(2); u16(16); text("data"); u32(bytes)
    return data
}
func prepareAudio(_ source: RecordingSource, directory: String, destination: String) async throws -> [String: Any] {
    guard let path = source.microphone ?? source.systemAudio else { throw NativeFailure("Recording has no microphone or system audio.", code: "audio_unavailable") }
    let (reader, output) = try await audioReader(projectURL(directory, path))
    let url = URL(fileURLWithPath: destination), temporary = URL(fileURLWithPath: destination + ".\(UUID().uuidString).tmp")
    guard !FileManager.default.fileExists(atPath: url.path) else { throw NativeFailure("Destination already exists.", code: "file_exists") }
    try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    return try await Task.detached(priority: .utility) {
        guard FileManager.default.createFile(atPath: temporary.path, contents: wavHeader(0)) else { throw NativeFailure("Cannot create speech audio file.") }
        let file = try FileHandle(forWritingTo: temporary)
        do {
            try file.seekToEnd(); var size: UInt64 = 0
            while let sample = output.copyNextSampleBuffer() {
                let data = try pcmData(sample)
                // Preserve track startup gaps in the speech timeline so transcript timestamps remain source-based.
                let expected = UInt64(max(0, milliseconds(sample.presentationTimeStamp)) * 16) * 2
                if expected > size + 64 { var gap = expected - size; while gap > 0 { let n = Int(min(gap, 32000)); try file.write(contentsOf: Data(count: n)); size += UInt64(n); gap -= UInt64(n) } }
                guard size + UInt64(data.count) < UInt64(UInt32.max - 36) else { throw NativeFailure("Speech audio exceeds WAV size limit.") }
                try file.write(contentsOf: data); size += UInt64(data.count)
            }
            if reader.status == .failed { throw reader.error ?? NativeFailure("Audio extraction failed.") }
            try file.seek(toOffset: 0); try file.write(contentsOf: wavHeader(UInt32(size))); try file.close()
            try FileManager.default.moveItem(at: temporary, to: url)
            return ["path": url.path]
        } catch { try? file.close(); try? FileManager.default.removeItem(at: temporary); throw error }
    }.value
}
