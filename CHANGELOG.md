# Changelog

## V1.0.1 - 2026-05-12

- Fixed Apple Silicon CLI downloads by publishing `stript-cli-macos-arm64.tar.gz` with executable permissions preserved.
- Renamed the macOS app bundle to `ImageStript.app` and kept the release app as a universal `x86_64` + `arm64` binary.
- Preserved macOS sandbox user-selected read/write entitlement for imported and exported image files.
- Added `SHA256SUMS` to release assets and limited production release publishing to tag/manual workflow runs.
- Added optional Apple Developer ID signing and notarization support in GitHub Actions; without those secrets, macOS Gatekeeper may still require right-click Open or quarantine removal.

## V1.0.0 - 2026-05-12

- Initial production release of ImageStript.
- Added Flutter app flow for selecting, scanning, processing, previewing, and saving images.
- Added Dart CLI for inspect-only mode and metadata-cleaning output.
- Added AI/source metadata detection for PNG, JPEG, and WebP containers.
- Added tests, analyzer gate, and release documentation.
- Updated release packaging for Apple Silicon users: macOS app bundle is universal, Unix CLI downloads are tarballs that preserve executable permissions, and the workflow supports Developer ID notarization when Apple secrets are configured.
