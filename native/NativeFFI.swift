import AppKit

public typealias NativeCallback = @convention(c) (UnsafePointer<CChar>?) -> Void

@_cdecl("screenrec_command")
public func screenrec_command(_ json: UnsafePointer<CChar>?, _ callback: NativeCallback?) {
    guard let callback else { return }
    let data = json.map { Data(String(cString: $0).utf8) } ?? Data()
    Task { @MainActor in
        var id: Any?
        do {
            guard let request = try JSONSerialization.jsonObject(with: data) as? [String: Any], let method = request["method"] as? String else { throw NativeFailure("Malformed native request.", code: "invalid_request") }
            id = request["id"]
            let result = try await NativeApp.shared.command(method, request["params"] as? [String: Any] ?? [:])
            var response: [String: Any] = ["result": result]; if let id { response["id"] = id }
            let output = try JSONSerialization.data(withJSONObject: response, options: [.sortedKeys])
            String(decoding: output, as: UTF8.self).withCString { callback($0) }
        } catch {
            var response: [String: Any] = ["error": ["code": (error as? NativeFailure)?.code ?? "native_error", "message": error.localizedDescription]]; if let id { response["id"] = id }
            let output = (try? JSONSerialization.data(withJSONObject: response)) ?? Data("{\"error\":{\"code\":\"native_error\",\"message\":\"Response encoding failed\"}}".utf8)
            String(decoding: output, as: UTF8.self).withCString { callback($0) }
        }
    }
}
@_cdecl("screenrec_attach_window")
public func screenrec_attach_window(_ pointer: UnsafeMutableRawPointer?) {
    guard let pointer else { return }
    DispatchQueue.main.async {
        let window = Unmanaged<NSWindow>.fromOpaque(pointer).takeUnretainedValue()
        NativeApp.shared.attach(window)
    }
}
