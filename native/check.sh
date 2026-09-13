#!/bin/sh
set -eu
cd "$(dirname "$0")"
mkdir -p build
xcrun swiftc -swift-version 5 -Onone -target "$(uname -m)-apple-macosx15.0" Models.swift Composition.swift Capture.swift Audio.swift Bridge.swift Check.swift -o build/native-check
build/native-check "$@"
