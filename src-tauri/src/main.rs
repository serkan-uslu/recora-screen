#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json::{json, Value};
use std::{collections::HashMap, ffi::{CStr, CString}, io::{BufRead, BufReader, Write}, os::raw::{c_char, c_void}, path::PathBuf, process::{Child, ChildStdin, Command, Stdio}, sync::{Arc, Mutex, OnceLock, atomic::{AtomicU64, Ordering}}, time::Duration};
use tauri::{Emitter, Manager};
use tokio::sync::oneshot;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

type Reply = Result<Value, Value>;
type Waiters = Arc<Mutex<HashMap<String, oneshot::Sender<Reply>>>>;
static NODE_INPUT: OnceLock<Arc<Mutex<ChildStdin>>> = OnceLock::new();
static NEXT_ID: AtomicU64 = AtomicU64::new(1);

#[cfg(target_os = "macos")]
extern "C" {
    fn screenrec_command(request: *const c_char, callback: extern "C" fn(*const c_char));
    fn screenrec_attach_window(window: *mut c_void);
}

extern "C" fn native_reply(pointer: *const c_char) {
    if pointer.is_null() { return; }
    let text = unsafe { CStr::from_ptr(pointer) }.to_string_lossy();
    match serde_json::from_str::<Value>(&text) {
        Ok(mut response) => {
            let id = response["id"].take();
            let Some(object) = response.as_object_mut() else { return; };
            object.insert("nativeResponse".into(), id);
            if let Some(input) = NODE_INPUT.get() {
                if let Ok(mut writer) = input.lock() {
                    let _ = writeln!(writer, "{}", response);
                    let _ = writer.flush();
                }
            }
        }
        Err(error) => eprintln!("Native bridge returned invalid JSON: {error}"),
    }
}

struct Backend {
    input: Arc<Mutex<ChildStdin>>,
    child: Mutex<Child>,
    pending: Waiters,
}

#[derive(Default)]
struct ShortcutErrors(Mutex<Vec<Value>>);

fn register_recording_shortcuts(app: &tauri::AppHandle) {
    let pause = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::Digit9);
    let stop = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::Digit0);
    let queue = Arc::new(tokio::sync::Mutex::new(()));
    let plugin = tauri_plugin_global_shortcut::Builder::new().with_handler(move |app, shortcut, event| {
        if event.state() != ShortcutState::Pressed || (*shortcut != pause && *shortcut != stop) { return; }
        let stop_requested = *shortcut == stop;
        let app = app.clone();
        let queue = queue.clone();
        tauri::async_runtime::spawn(async move {
            // Serialize status + action so two quick presses observe each other's new state.
            let _guard = queue.lock().await;
            let result: Reply = async {
                let backend = app.state::<Backend>();
                let status = backend.call(json!({"method":"recording.status","params":{}})).await?;
                if let Some(error) = status["error"].as_str() { return Err(json!({"code":"SHORTCUT_FAILED","message":error})); }
                if status["active"].as_bool() != Some(true) { return Ok(Value::Null); }
                let method = recording_shortcut_method(stop_requested, status["paused"].as_bool() == Some(true));
                backend.call(json!({"method":method,"params":{}})).await
            }.await;
            if let Err(error) = result { let _ = app.emit("shortcut-error", error); }
        });
    }).build();
    let mut failures = Vec::new();
    if let Err(error) = app.plugin(plugin) {
        failures.push(json!({"code":"SHORTCUT_REGISTRATION_FAILED","message":format!("Global recording shortcuts are unavailable: {error}")}));
    } else {
        for (shortcut, label) in [(pause, "⌘⇧9"), (stop, "⌘⇧0")] {
            if let Err(error) = app.global_shortcut().register(shortcut) {
                failures.push(json!({"code":"SHORTCUT_REGISTRATION_FAILED","message":format!("Could not register {label}. It may be used by another app: {error}")}));
            }
        }
    }
    *app.state::<ShortcutErrors>().0.lock().unwrap() = failures.clone();
    for error in failures { let _ = app.emit("shortcut-error", error); }
}

fn recording_shortcut_method(stop: bool, paused: bool) -> &'static str {
    if stop { "recording.stop" } else if paused { "recording.resume" } else { "recording.pause" }
}

impl Backend {
    fn start(app: &tauri::AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        let resources = if cfg!(debug_assertions) {
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../resources")
        } else { app.path().resource_dir()? };
        let resources = resources.canonicalize()?;
        let exe = std::env::current_exe()?;
        let app_bundle = exe.parent().and_then(|p| p.parent()).and_then(|p| p.parent()).unwrap_or(&resources);
        let mut child = Command::new(resources.join("bin/node"))
            .arg(resources.join("server.mjs"))
            .env("SCREENREC_RESOURCES", &resources)
            .env("SCREENREC_APP_BUNDLE", app_bundle)
            .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::inherit()).spawn()?;
        let input = Arc::new(Mutex::new(child.stdin.take().ok_or("Missing Node stdin")?));
        NODE_INPUT.set(input.clone()).map_err(|_| "Backend already initialized")?;
        let output = child.stdout.take().ok_or("Missing Node stdout")?;
        let pending: Waiters = Arc::new(Mutex::new(HashMap::new()));
        let waits = pending.clone();
        let handle = app.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(output).lines() {
                let Ok(line) = line else { break; };
                let message: Value = match serde_json::from_str(&line) {
                    Ok(value) => value,
                    Err(_) => { eprintln!("Ignored non-protocol backend output"); continue; }
                };
                if message["native"].as_bool() == Some(true) {
                    #[cfg(target_os = "macos")]
                    if let Ok(request) = CString::new(message.to_string()) {
                        let _ = handle.run_on_main_thread(move || unsafe { screenrec_command(request.as_ptr(), native_reply) });
                    }
                } else if let Some(id) = message["id"].as_str() {
                    if let Some(sender) = waits.lock().unwrap().remove(id) {
                        let _ = sender.send(if !message["error"].is_null() { Err(message["error"].clone()) } else { Ok(message["result"].clone()) });
                    }
                } else if let Some(event) = message["event"].as_str() {
                    let _ = handle.emit(event, &message["data"]);
                }
            }
            for (_, sender) in waits.lock().unwrap().drain() {
                let _ = sender.send(Err(json!({"code":"BACKEND_STOPPED","message":"The project service stopped. Your last saved drafts are safe. Restart the app to continue."})));
            }
            let _ = handle.emit("backend-stopped", ());
        });
        Ok(Self { input, child: Mutex::new(child), pending })
    }

    async fn call(&self, mut request: Value) -> Reply {
        if !request.is_object() { return Err(json!({"code":"INVALID_REQUEST","message":"Expected a command object."})); }
        let id = format!("ui-{}", NEXT_ID.fetch_add(1, Ordering::Relaxed));
        request["id"] = json!(&id);
        let (sender, receiver) = oneshot::channel();
        self.pending.lock().unwrap().insert(id.clone(), sender);
        let written = self.input.lock().map_err(|_| "Backend input unavailable").and_then(|mut input| {
            writeln!(input, "{}", request).and_then(|_| input.flush()).map_err(|_| "Backend input closed")
        });
        if let Err(message) = written {
            self.pending.lock().unwrap().remove(&id);
            return Err(json!({"code":"BACKEND_STOPPED","message":message}));
        }
        match tokio::time::timeout(Duration::from_secs(120), receiver).await {
            Ok(Ok(result)) => result,
            _ => {
                self.pending.lock().unwrap().remove(&id);
                Err(json!({"code":"COMMAND_TIMEOUT","message":"The operation did not respond in time. Check its status before retrying."}))
            }
        }
    }
}

#[tauri::command]
async fn command(request: Value, app: tauri::AppHandle, backend: tauri::State<'_, Backend>) -> Reply {
    let method = request["method"].as_str().unwrap_or("").to_owned();
    let mut result = backend.call(request).await?;
    if method == "app.capabilities" {
        let errors = app.state::<ShortcutErrors>().0.lock().unwrap().clone();
        for error in &errors { let _ = app.emit("shortcut-error", error); }
        result["shortcutErrors"] = json!(errors);
    }
    if method == "project.list" {
        if let Some(projects) = result.as_array() {
            for project in projects {
                if let Some(path) = project["path"].as_str() { let _ = app.asset_protocol_scope().allow_directory(path, true); }
            }
        }
    }
    if method == "preview.frame" {
        if let Some(path) = result["path"].as_str() { let _ = app.asset_protocol_scope().allow_file(path); }
    }
    Ok(result)
}

fn request_quit(handle: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let backend = handle.state::<Backend>();
        match backend.call(json!({"method":"app.shutdown"})).await {
            Ok(_) => handle.exit(0),
            Err(error) => { let _ = handle.emit("app-close-blocked", error); }
        }
    });
}

fn main() {
    // Exercise the real dyld/signature path without opening windows or touching project storage.
    if std::env::args().any(|arg| arg == "--bundle-check") {
        println!("Screen Recorder {} native bundle ready", env!("CARGO_PKG_VERSION"));
        return;
    }
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") { let _ = window.show(); let _ = window.set_focus(); }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![command])
        .setup(|app| {
            let backend = Backend::start(app.handle())?;
            app.manage(backend);
            app.manage(ShortcutErrors::default());
            register_recording_shortcuts(app.handle());
            #[cfg(target_os = "macos")]
            if let Some(window) = app.get_webview_window("main") {
                window.with_webview(|view| unsafe { screenrec_attach_window(view.ns_window() as *mut c_void) })?;
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Could not start Screen Recorder");

    app.run(|app, event| match event {
        tauri::RunEvent::ExitRequested { api, code, .. } if code.is_none() => {
            api.prevent_exit();
            request_quit(app.clone());
        }
        tauri::RunEvent::WindowEvent { event: tauri::WindowEvent::CloseRequested { api, .. }, .. } => {
            api.prevent_close();
            request_quit(app.clone());
        }
        tauri::RunEvent::Exit => {
            if let Some(backend) = app.try_state::<Backend>() {
                if let Ok(mut child) = backend.child.lock() { let _ = child.kill(); let _ = child.wait(); }
            }
        }
        _ => {}
    });
}

#[cfg(test)]
mod tests {
    use super::recording_shortcut_method;

    #[test]
    fn recording_shortcuts_choose_the_validated_backend_method() {
        assert_eq!(recording_shortcut_method(false, false), "recording.pause");
        assert_eq!(recording_shortcut_method(false, true), "recording.resume");
        assert_eq!(recording_shortcut_method(true, false), "recording.stop");
        assert_eq!(recording_shortcut_method(true, true), "recording.stop");
    }
}
