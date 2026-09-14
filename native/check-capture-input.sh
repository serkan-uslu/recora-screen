#!/bin/sh
set -eu
cd "$(dirname "$0")"
mkdir -p build
xcrun swiftc -swift-version 5 -Onone -target "$(uname -m)-apple-macosx15.0" Models.swift CaptureInput.swift CaptureWriter.swift CameraBubbleView.swift Capture.swift CaptureCheck.swift -o build/capture-input-check
build/capture-input-check
