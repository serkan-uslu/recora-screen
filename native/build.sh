#!/bin/sh
set -eu
cd "$(dirname "$0")"
ARCH="${1:-$(uname -m)}"
mkdir -p build
OUTPUT="build/.libscreenrec.$$.dylib"
trap 'rm -f "$OUTPUT"' EXIT
xcrun swiftc -swift-version 5 -O -emit-library -module-name ScreenrecNative -target "$ARCH-apple-macosx15.0" Models.swift CompositionGeometry.swift RenderInstruction.swift ScreenrecCompositor.swift Composition.swift CaptureInput.swift CaptureWriter.swift CameraBubbleView.swift Capture.swift Audio.swift PreviewView.swift Bridge.swift NativeAppSupport.swift NativeFFI.swift -o "$OUTPUT" -Xlinker -install_name -Xlinker @rpath/libscreenrec.dylib
mv -f "$OUTPUT" build/libscreenrec.dylib
