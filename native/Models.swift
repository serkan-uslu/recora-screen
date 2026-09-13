import Foundation
import AVFoundation
import AppKit

struct MediaRange: Codable { var startMs: Double; var endMs: Double
    func contains(_ time: Double) -> Bool { time >= startMs && time < endMs }
}
struct CaptureSettings: Codable {
    struct Region: Codable { var x: Double; var y: Double; var width: Double; var height: Double }
    var sourceId: String; var sourceKind: String; var region: Region?
    var cameraId: String?; var microphoneId: String?; var systemAudio: Bool
    var cameraShape: String; var width: Int; var height: Int; var fps: Int
}
struct RecordingSource: Codable {
    var durationMs: Double; var width: Int; var height: Int; var fps: Double
    var screen: String; var camera: String?; var microphone: String?; var systemAudio: String?; var cursor: String?
    var cameraActiveRanges: [MediaRange]? = nil
}
struct CursorEvent: Codable { var tMs: Double; var x: Double; var y: Double; var click: Bool? }
struct CameraSettings: Codable {
    var visible: Bool; var shape: String; var x: Double; var y: Double; var size: Double; var shadow: Bool; var hiddenRanges: [MediaRange]
}
struct Zoom: Codable { var id: String; var startMs: Double; var endMs: Double; var scale: Double; var x: Double; var y: Double }
struct Overlay: Codable {
    var id: String; var kind: String; var startMs: Double; var endMs: Double
    var text: String?; var assetId: String?; var x: Double; var y: Double; var width: Double
    var fontSize: Double; var color: String; var animation: String
}
struct TranscriptSegment: Codable { var id: String; var startMs: Double; var endMs: Double; var text: String }
struct MediaAsset: Codable { var id: String; var name: String; var path: String; var kind: String }
struct EditState: Codable {
    struct Audio: Codable { var microphoneVolume: Double; var systemVolume: Double }
    struct Cursor: Codable { var visible: Bool; var highlight: Bool; var smooth: Bool; var size: Double }
    struct Captions: Codable { var enabled: Bool; var fontSize: Double; var color: String; var background: String }
    var segments: [MediaRange]; var camera: CameraSettings; var zooms: [Zoom]; var overlays: [Overlay]
    var audio: Audio; var cursor: Cursor; var captions: Captions
}
struct Project: Codable {
    var schemaVersion: Int; var id: String; var name: String; var source: RecordingSource?
    var edits: EditState; var transcript: [TranscriptSegment]; var assets: [MediaAsset]
}
struct NativeFailure: Error, LocalizedError {
    var code: String; var message: String
    init(_ message: String, code: String = "native_error") { self.message = message; self.code = code }
    var errorDescription: String? { message }
}
func decode<T: Decodable>(_ type: T.Type, _ object: Any) throws -> T {
    try JSONDecoder().decode(type, from: JSONSerialization.data(withJSONObject: object))
}
func jsonObject<T: Encodable>(_ value: T) throws -> Any { try JSONSerialization.jsonObject(with: JSONEncoder().encode(value)) }
func milliseconds(_ time: CMTime) -> Double { let n = time.seconds * 1000; return n.isFinite ? n : 0 }
func mediaTime(_ ms: Double) -> CMTime { CMTime(seconds: ms / 1000, preferredTimescale: 600_000) }
func sourceTime(_ ranges: [MediaRange], _ timelineMs: Double) -> Double {
    var remaining = max(0, timelineMs)
    for range in ranges { let n = range.endMs - range.startMs; if remaining < n { return range.startMs + remaining }; remaining -= n }
    return ranges.last?.endMs ?? 0
}
func timelineDuration(_ ranges: [MediaRange]) -> Double { ranges.reduce(0) { $0 + max(0, $1.endMs - $1.startMs) } }
func projectURL(_ directory: String, _ relative: String) throws -> URL {
    let root = URL(fileURLWithPath: directory, isDirectory: true).standardizedFileURL.resolvingSymlinksInPath()
    guard !relative.hasPrefix("/"), !relative.split(separator: "/").contains("..") else { throw NativeFailure("Media path must be inside the project.", code: "invalid_path") }
    let result = root.appendingPathComponent(relative).standardizedFileURL.resolvingSymlinksInPath()
    guard result.path.hasPrefix(root.path + "/") else { throw NativeFailure("Media path escapes the project.", code: "invalid_path") }
    return result
}
func requiredString(_ params: [String: Any], _ name: String) throws -> String {
    guard let value = params[name] as? String, !value.isEmpty else { throw NativeFailure("Missing \(name).", code: "invalid_params") }; return value
}
func color(_ hex: String, alpha: CGFloat = 1) -> NSColor {
    let s = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#")); var v: UInt64 = 0
    guard Scanner(string: s).scanHexInt64(&v), s.count == 6 else { return .white }
    return NSColor(srgbRed: CGFloat((v >> 16) & 255) / 255, green: CGFloat((v >> 8) & 255) / 255, blue: CGFloat(v & 255) / 255, alpha: alpha)
}

func readCursor(_ data: Data) -> [CursorEvent] {
    if let events = try? JSONDecoder().decode([CursorEvent].self, from: data) { return events }
    // A crash can interrupt an append; retain only complete events from the streamed JSON array.
    guard let end = data.lastIndex(of: 125) else { return [] }
    return (try? JSONDecoder().decode([CursorEvent].self, from: data.prefix(through: end) + Data("]".utf8))) ?? []
}
