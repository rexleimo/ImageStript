# ImageStript

ImageStript (`stript`) is a Flutter desktop/mobile app plus a Dart CLI for inspecting and removing image AI/source metadata before sharing. It decodes image pixels into a fresh raster, strips embedded metadata containers, optionally applies small pixel perturbations, and writes clean PNG output.

## Features

- Inspect AI/source metadata before processing.
- Remove embedded EXIF/XMP/ICC/C2PA/content credential containers by re-rasterizing output.
- Detect common AI generation traces such as Stable Diffusion parameters, ComfyUI/InvokeAI workflows, Midjourney, DALL-E, Firefly, C2PA, and IPTC `trainedAlgorithmicMedia` signals.
- Use presets or advanced controls for noise, resize perturbation, and JPEG round-trip quality.
- Process one image or a batch from the app or CLI.

## Metadata Coverage

Current scanner coverage:

- PNG chunks: `tEXt`, `zTXt`, `iTXt`, `eXIf`, `iCCP`, `caBX`, `c2pa`
- JPEG segments: APP1/EXIF/XMP, APP2/ICC, APP11/JUMBF/C2PA, comments
- WebP chunks: `EXIF`, `XMP `, `ICCP`, `C2PA`

The output pipeline writes a new PNG from decoded pixels, so file-level metadata containers are dropped. No local tool can guarantee removal of every visual/statistical watermark; ImageStript focuses on binary metadata and optional light pixel perturbation.

## Development Environment

### Requirements

- macOS/Linux/Windows development machine
- Git
- FVM (`fvm`) for Flutter version management
- Flutter `3.29.3` / Dart `3.7.2` via FVM
- Xcode for macOS/iOS builds
- Android Studio + Android SDK for Android builds

### Setup

```bash
git clone git@github.com:rexleimo/ImageStript.git
cd ImageStript
fvm install 3.29.3
fvm use 3.29.3
fvm flutter pub get
```

Check the local toolchain:

```bash
fvm flutter doctor
fvm flutter --version
```

### Run the App

```bash
fvm flutter run -d macos
```

Other targets depend on installed SDKs:

```bash
fvm flutter devices
fvm flutter run -d android
fvm flutter run -d ios
```

## CLI Usage

Inspect an image without writing output:

```bash
fvm dart run bin/stript.dart path/to/image.png --inspect-only
```

Process one file:

```bash
fvm dart run bin/stript.dart path/to/image.png -o /tmp/stript-output
```

Process a folder with the aggressive preset:

```bash
fvm dart run bin/stript.dart path/to/folder --aggressive
```

Options:

- `--inspect-only`: print detailed AI/source metadata findings without writing output
- `--output`, `-o`: output file directory
- `--noise`: fraction of pixels to adjust, default `0.03`
- `--strength`: per-channel noise strength, default `1`
- `--resize`: shrink-and-restore scale, default `0.998`
- `--jpeg`: JPEG round-trip quality before final PNG output, default `97`
- `--aggressive`: use the aggressive preset

## Testing and Quality Gates

Run before every release:

```bash
fvm flutter test
fvm flutter analyze
```

Optional CLI smoke test:

```bash
fvm dart run bin/stript.dart path/to/image.png --inspect-only
fvm dart run bin/stript.dart path/to/image.png -o /tmp/stript-output
```

## Production Build

Production downloads are built by GitHub Actions, not by committing local build output. Use local builds only for smoke testing before pushing.

Build a local macOS release app:

```bash
fvm flutter build macos --release
```

Build a standalone CLI binary:

```bash
mkdir -p build/release
fvm dart compile exe bin/stript.dart -o build/release/stript
```

Android release build, when the Android SDK is configured:

```bash
fvm flutter build apk --release
```

Release artifacts are generated under `build/` locally and are not committed.

## Apple Silicon Download Notes

For Apple Silicon Macs, download:

- GUI app: `ImageStript-macos.zip`
- CLI: `stript-cli-macos-arm64.tar.gz`

The macOS app is a universal binary (`x86_64` + `arm64`). The CLI tarball preserves the executable bit; the legacy raw `stript-cli-macos-arm64` binary did not, so macOS downloaded it as a non-executable file.

Install the CLI:

```bash
tar -xzf stript-cli-macos-arm64.tar.gz
./stript-cli-macos-arm64 --help
```

If macOS blocks the app or CLI because the release is not notarized, use one of these trust overrides only after verifying that you downloaded it from the official release page:

```bash
# GUI app after moving ImageStript.app into /Applications
xattr -dr com.apple.quarantine /Applications/ImageStript.app
open /Applications/ImageStript.app

# CLI
xattr -d com.apple.quarantine ./stript-cli-macos-arm64 2>/dev/null || true
./stript-cli-macos-arm64 --help
```

For a no-warning macOS install, the GitHub repository must be configured with Apple Developer ID signing and notarization secrets:

- `MACOS_CERTIFICATE_P12_BASE64`
- `MACOS_CERTIFICATE_PASSWORD`
- `MACOS_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_TEAM_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`

## Release Workflow

```bash
git status --short
fvm flutter test
fvm flutter analyze
git push origin main
git tag V1.0.1
git push origin V1.0.1
```

GitHub Actions publishes user-downloadable assets to the tagged release, currently `V1.0.1`:

- `ImageStript-macos.zip`
- `ImageStript-windows.zip`
- `ImageStript-android.apk`
- `SHA256SUMS`
- `stript-cli-linux-x64.tar.gz`
- `stript-cli-macos-arm64.tar.gz`
- `stript-cli-windows-x64.exe`

Release page: <https://github.com/rexleimo/ImageStript/releases/tag/V1.0.1>
