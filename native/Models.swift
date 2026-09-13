import Foundation
import AVFoundation
import AppKit

struct MediaRange: Codable { var startMs: Double; var endMs: Double; var speed: Double? = nil
    var rate: Double { speed ?? 1 }
    var outputDuration: Double { max(0, endMs - startMs) / rate }
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
    var title: String? = nil
}
struct CursorEvent: Codable { var tMs: Double; var x: Double; var y: Double; var click: Bool?; var kind: String? = nil }
struct CameraSettings: Codable {
    var visible: Bool; var shape: String; var x: Double; var y: Double; var size: Double; var shadow: Bool; var hiddenRanges: [MediaRange]
}
struct Zoom: Codable { var id: String; var startMs: Double; var endMs: Double; var scale: Double; var x: Double; var y: Double; var motion: String? = nil; var followCursor: Bool? = nil }
struct CanvasSettings: Codable {
    var aspectRatio: String = "16:9"; var background: String = "gradient"
    var color: String = "#111827"; var gradientTo: String = "#115e59"; var gradientAngle: Double = 135
    var wallpaper: String = "aurora"; var assetId: String? = nil; var blur: Double = 0
    var padding: Double = 0.06; var radius: Double = 0.025; var shadow: Double = 0.35
    var frame: String = "none"; var title: String = ""
}
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
    var canvas: CanvasSettings? = nil
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
    for range in ranges { let n = range.outputDuration; if remaining < n { return range.startMs + remaining * range.rate }; remaining -= n }
    return ranges.last?.endMs ?? 0
}
func timelineDuration(_ ranges: [MediaRange]) -> Double { ranges.reduce(0) { $0 + $1.outputDuration } }
func renderDimensions(_ project: Project, longEdge: Int? = nil) -> CGSize {
    let sw = CGFloat(project.source?.width ?? 1920), sh = CGFloat(project.source?.height ?? 1080)
    let ratios: [String: CGFloat] = ["16:9": 16 / 9, "9:16": 9 / 16, "1:1": 1, "4:5": 4 / 5]
    let ratio = ratios[project.edits.canvas?.aspectRatio ?? "source"] ?? sw / max(1, sh)
    let edge = CGFloat(longEdge ?? Int(max(sw, sh)))
    func even(_ n: CGFloat) -> CGFloat { max(16, (n / 2).rounded() * 2) }
    return ratio >= 1 ? CGSize(width: even(edge), height: even(edge / ratio)) : CGSize(width: even(edge * ratio), height: even(edge))
}
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
    let scanner = Scanner(string: s)
    guard scanner.scanHexInt64(&v), scanner.isAtEnd, s.count == 6 || s.count == 8 else { return .white }
    let embeddedAlpha = s.count == 8 ? CGFloat(v & 255) / 255 : 1
    if s.count == 8 { v >>= 8 }
    return NSColor(srgbRed: CGFloat((v >> 16) & 255) / 255, green: CGFloat((v >> 8) & 255) / 255, blue: CGFloat(v & 255) / 255, alpha: max(0, min(1, alpha * embeddedAlpha)))
}

func readCursor(_ data: Data) -> [CursorEvent] {
    if let events = try? JSONDecoder().decode([CursorEvent].self, from: data) { return events }
    // A crash can interrupt an append; retain only complete events from the streamed JSON array.
    guard let end = data.lastIndex(of: 125) else { return [] }
    return (try? JSONDecoder().decode([CursorEvent].self, from: data.prefix(through: end) + Data("]".utf8))) ?? []
}
