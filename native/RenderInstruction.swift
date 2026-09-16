import AVFoundation
import CoreImage

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
    let mediaTransforms: [String: CGAffineTransform]
    let mediaSizes: [String: CGSize]
    let renderZooms: [Zoom]
    let focusPaths: [String: [CursorEvent]]
    let clicks: [CursorEvent]
    let interactions: [CursorEvent]
    let cameraRuns: [CameraRun]
    init(project: Project, duration: CMTime, screenID: CMPersistentTrackID, cameraID: CMPersistentTrackID?, cursor: [CursorEvent], directory: String, images: [String: CIImage], transforms: [CMPersistentTrackID: CGAffineTransform], mediaTransforms: [String: CGAffineTransform] = [:], mediaSizes: [String: CGSize] = [:], previous: RenderInstruction? = nil) {
        let renderCursor = previous?.cursor ?? cursor.filter { $0.kind != "typing" }
        self.project = project; self.screenID = screenID; self.cameraID = cameraID; self.cursor = renderCursor; self.directory = directory; self.images = images; self.transforms = transforms; self.mediaTransforms = mediaTransforms; self.mediaSizes = mediaSizes
        var clicks: [CursorEvent] = [], pressed = false
        for event in renderCursor {
            if event.kind == "click" || (event.click == true && !pressed) { clicks.append(event) }
            pressed = event.click == true
        }
        self.clicks = clicks
        self.interactions = cursor; self.cameraRuns = cameraOutputRuns(project)
        let renderZooms = continuousZooms(project.edits.zooms)
        self.renderZooms = renderZooms
        self.focusPaths = Dictionary(renderZooms.map { zoom in
            let unchanged = previous?.renderZooms.first(where: { $0.id == zoom.id }).map { (try? JSONEncoder().encode($0)) == (try? JSONEncoder().encode(zoom)) } ?? false
            return (zoom.id, unchanged ? (previous?.focusPaths[zoom.id] ?? []) : zoomFocusPath(zoom, cursor: renderCursor, interactions: cursor))
        }, uniquingKeysWith: { _, last in last })
        timeRange = CMTimeRange(start: .zero, duration: duration)
        requiredSourceTrackIDs = ([screenID] + (cameraID.map { [$0] } ?? [])).map { NSNumber(value: $0) }
    }
}
