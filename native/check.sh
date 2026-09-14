#!/bin/sh
set -eu
cd "$(dirname "$0")"
mkdir -p build
xcrun swiftc -swift-version 5 -Onone -target "$(uname -m)-apple-macosx15.0" Models.swift CompositionGeometry.swift RenderInstruction.swift ScreenrecCompositor.swift Composition.swift CaptureInput.swift CaptureWriter.swift CameraBubbleView.swift Capture.swift Audio.swift PreviewView.swift Bridge.swift NativeAppSupport.swift NativeFFI.swift Check.swift -o build/native-check
build/native-check "$@"
