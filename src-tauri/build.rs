use std::{env, path::PathBuf, process::Command};

fn main() {
    if env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        let native = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap()).join("../native");
        for entry in std::fs::read_dir(&native).unwrap().flatten() {
            if entry.path().extension().and_then(|x| x.to_str()) == Some("swift") {
                println!("cargo:rerun-if-changed={}", entry.path().display());
            }
        }
        println!("cargo:rerun-if-changed={}", native.join("build.sh").display());
        let status = Command::new("bash").arg(native.join("build.sh")).status().expect("Run native/build.sh");
        assert!(status.success(), "Swift media module did not compile");
        let lib = native.join("build").canonicalize().unwrap();
        println!("cargo:rustc-link-search=native={}", lib.display());
        println!("cargo:rustc-link-lib=dylib=screenrec");
        println!("cargo:rustc-link-arg=-Wl,-rpath,@executable_path/../Frameworks");
        if env::var("PROFILE").as_deref() == Ok("debug") {
            println!("cargo:rustc-link-arg=-Wl,-rpath,{}", lib.display());
        }
    }
    tauri_build::build();
}
