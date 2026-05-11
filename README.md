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

Build a macOS production app:

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

Release artifacts are generated under `build/` and are not committed.

## Release Workflow

```bash
git status --short
fvm flutter test
fvm flutter analyze
git tag V1.0.0
git push origin main
git push origin V1.0.0
```

For GitHub production release publishing, create a release from tag `V1.0.0` and attach the generated artifacts from `build/`.
