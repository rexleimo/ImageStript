import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:stript/core/metadata_inspector.dart';
import 'package:stript/core/metadata_stripper.dart';

void main() {
  group('MetadataInspector', () {
    test('detects AI generator details in PNG text chunks', () {
      final src = img.Image(width: 3, height: 3);
      final png = _insertPngChunk(
        img.encodePng(src),
        'tEXt',
        latin1.encode(
          'parameters\u0000prompt: neon city\nNegative prompt: blur\nSteps: 30, Seed: 42, Model: SDXL',
        ),
      );

      final report = MetadataInspector.inspect(Uint8List.fromList(png));

      expect(report.hasAiMetadata, isTrue);
      expect(report.findings.map((f) => f.container), contains('PNG tEXt'));
      expect(report.summary, contains('Stable Diffusion'));
    });

    test(
      'detects C2PA provenance chunks in PNG, JPEG, and WebP containers',
      () {
        final src = img.Image(width: 2, height: 2);
        final png = _insertPngChunk(
          img.encodePng(src),
          'caBX',
          latin1.encode('c2pa.ai-disclosure trainedAlgorithmicMedia'),
        );
        final jpeg = _insertJpegSegment(
          img.encodeJpg(src),
          0xeb,
          latin1.encode('JUMBF c2pa.ai-disclosure trainedAlgorithmicMedia'),
        );
        final webp = _minimalWebPWithChunk(
          'C2PA',
          latin1.encode('c2pa.ai-disclosure trainedAlgorithmicMedia'),
        );

        expect(
          MetadataInspector.inspect(Uint8List.fromList(png)).hasAiMetadata,
          isTrue,
        );
        expect(
          MetadataInspector.inspect(Uint8List.fromList(jpeg)).hasAiMetadata,
          isTrue,
        );
        expect(
          MetadataInspector.inspect(Uint8List.fromList(webp)).hasAiMetadata,
          isTrue,
        );
      },
    );

    test('detects opaque C2PA chunk containers without readable strings', () {
      final src = img.Image(width: 2, height: 2);
      final png = _insertPngChunk(img.encodePng(src), 'caBX', [0, 1, 2, 3, 4]);
      final webp = _minimalWebPWithChunk('C2PA', [0, 1, 2, 3, 4]);

      expect(
        MetadataInspector.inspect(Uint8List.fromList(png)).summary,
        contains('C2PA/content provenance metadata'),
      );
      expect(
        MetadataInspector.inspect(Uint8List.fromList(webp)).summary,
        contains('C2PA/content provenance metadata'),
      );
    });

    test('strip removes AI metadata findings from output bytes', () {
      final src = img.Image(width: 4, height: 4);
      final png = _insertPngChunk(img.encodePng(src), 'iTXt', [
        ...utf8.encode('prompt'),
        0,
        0,
        0,
        0,
        0,
        ...utf8.encode(
          'ComfyUI workflow prompt with Seed 123 and Model checkpoint',
        ),
      ]);

      final before = MetadataInspector.inspect(Uint8List.fromList(png));
      final stripped = MetadataStripper.strip(Uint8List.fromList(png));
      final after = MetadataInspector.inspect(stripped);

      expect(before.hasAiMetadata, isTrue);
      expect(after.hasAiMetadata, isFalse);
      expect(stripped, isNot(containsAllInOrder(utf8.encode('ComfyUI'))));
    });

    test('renders detailed report lines for CLI and UI surfaces', () {
      const report = MetadataReport([
        MetadataFinding(
          container: 'PNG tEXt',
          signal: 'Stable Diffusion prompt/parameters',
          detail: 'Seed: 42',
          snippet: 'prompt data Seed: 42 Model: SDXL',
        ),
      ]);

      expect(
        report.detailLines(),
        contains(
          'PNG tEXt: Stable Diffusion prompt/parameters (Seed: 42) - prompt data Seed: 42 Model: SDXL',
        ),
      );
    });
  });
}

List<int> _insertPngChunk(List<int> png, String type, List<int> data) {
  final iend = _findPngChunk(png, 'IEND');
  final chunk = _pngChunk(type, data);
  return [...png.take(iend), ...chunk, ...png.skip(iend)];
}

int _findPngChunk(List<int> png, String type) {
  var offset = 8;
  while (offset + 12 <= png.length) {
    final length = _readUint32(png, offset);
    final chunkType = latin1.decode(png.sublist(offset + 4, offset + 8));
    if (chunkType == type) return offset;
    offset += 12 + length;
  }
  throw StateError('Chunk $type not found');
}

List<int> _pngChunk(String type, List<int> data) {
  final bytes = <int>[];
  _writeUint32(bytes, data.length);
  bytes.addAll(latin1.encode(type));
  bytes.addAll(data);
  _writeUint32(bytes, _crc32([...latin1.encode(type), ...data]));
  return bytes;
}

List<int> _insertJpegSegment(List<int> jpeg, int marker, List<int> payload) {
  final segment = [
    0xff,
    marker,
    ((payload.length + 2) >> 8) & 0xff,
    (payload.length + 2) & 0xff,
    ...payload,
  ];
  return [jpeg[0], jpeg[1], ...segment, ...jpeg.skip(2)];
}

List<int> _minimalWebPWithChunk(String chunkType, List<int> payload) {
  final paddedPayload = payload.length.isOdd ? [...payload, 0] : payload;
  final bytes = <int>[...ascii.encode('RIFF')];
  _writeUint32Le(bytes, 4 + 8 + paddedPayload.length);
  bytes.addAll(ascii.encode('WEBP'));
  bytes.addAll(ascii.encode(chunkType));
  _writeUint32Le(bytes, payload.length);
  bytes.addAll(paddedPayload);
  return bytes;
}

int _readUint32(List<int> bytes, int offset) =>
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3];

void _writeUint32(List<int> out, int value) {
  out
    ..add((value >> 24) & 0xff)
    ..add((value >> 16) & 0xff)
    ..add((value >> 8) & 0xff)
    ..add(value & 0xff);
}

void _writeUint32Le(List<int> out, int value) {
  out
    ..add(value & 0xff)
    ..add((value >> 8) & 0xff)
    ..add((value >> 16) & 0xff)
    ..add((value >> 24) & 0xff);
}

int _crc32(List<int> bytes) {
  var crc = 0xffffffff;
  for (final byte in bytes) {
    crc ^= byte;
    for (var i = 0; i < 8; i++) {
      crc = (crc & 1) == 1 ? 0xedb88320 ^ (crc >> 1) : crc >> 1;
    }
  }
  return (crc ^ 0xffffffff) & 0xffffffff;
}
