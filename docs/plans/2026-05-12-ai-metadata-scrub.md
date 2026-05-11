# AI Metadata Scrub Plan and Audit

Date: 2026-05-12
Project: stript

## Objective

Continue improving the app so it can inspect image binary metadata, identify AI/source provenance signals, and remove those signals from output images when found.

## AI-related metadata surfaces

Implemented scanner coverage:

- PNG chunks: `tEXt`, `zTXt`, `iTXt`, `eXIf`, `iCCP`, `caBX`, `c2pa`
- JPEG segments: APP1/EXIF/XMP, APP2/ICC, APP11/JUMBF/C2PA, COM
- WebP chunks: `EXIF`, `XMP `, `ICCP`, `C2PA`
- AI/source signatures: Stable Diffusion parameters, ComfyUI/InvokeAI workflow data, Midjourney, DALL-E, Firefly, C2PA, Content Credentials, IPTC `trainedAlgorithmicMedia`, XMP creator/source fields

## Implemented artifacts

- `lib/core/metadata_inspector.dart`: binary metadata scanner and detailed report lines
- `lib/core/metadata_stripper.dart`: decode/re-rasterize/encode clean PNG path that drops metadata containers
- `lib/app/widgets/metadata_report_card.dart`: app scan summary and finding details
- `lib/app/screens/home_screen.dart`: scans selected files and renders metadata report card
- `lib/app/services/processing_service.dart`: file-level metadata inspection entry point
- `bin/stript.dart`: CLI scan before processing, `--inspect-only`, and single-file input fix
- `README.md`: usage and scope documentation

## Verification commands

Fresh verification used for this iteration:

```bash
fvm flutter test
fvm flutter analyze
fvm dart run bin/stript.dart /tmp/stript_ai_meta.png --inspect-only -o /tmp/stript_inspect_verify
fvm dart run bin/stript.dart /tmp/stript_ai_meta.png -o /tmp/stript_process_verify
strings /tmp/stript_process_verify/stript_ai_meta.png | grep -E 'ComfyUI|Seed|SDXL|parameters'
```

Expected evidence:

- Tests: all pass (`26 tests passed` in latest run)
- Analyze: `No issues found`
- Inspect-only: prints detailed findings and creates no output directory
- Process mode: output file does not contain `ComfyUI`, `Seed`, `SDXL`, or `parameters` strings

## Current blocker

The actual user-provided `Image #1` is not available as a local filesystem path in this workspace. Searches of likely attachment/cache locations found no current image attachment for this thread. The app/CLI capability is ready, but the specific image cannot be analyzed or scrubbed until the user provides a path.

Required user input:

```bash
/path/to/Image-1.png
```

Then run:

```bash
fvm dart run bin/stript.dart /path/to/Image-1.png --inspect-only
fvm dart run bin/stript.dart /path/to/Image-1.png -o /tmp/stript-output
```
