#!/bin/bash
set -e
echo "Building Stript for all platforms..."
flutter build macos --release
echo "macOS build: build/macos/Build/Products/Release/stript.app"
flutter build windows --release
echo "Windows build: build/windows/runner/Release/"
flutter build ios --release
echo "iOS build: build/ios/ (archive with Xcode for App Store)"
flutter build apk --release
echo "Android build: build/app/outputs/flutter-apk/app-release.apk"
echo "CLI binary:"
dart compile exe bin/stript.dart -o stript
echo "Done."
