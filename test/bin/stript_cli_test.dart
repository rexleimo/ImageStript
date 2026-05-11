import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;

void main() {
  test(
    'CLI inspect-only prints detailed AI metadata without writing output',
    () async {
      final tempDir = await Directory.systemTemp.createTemp('stript_cli_test_');
      addTearDown(() => tempDir.deleteSync(recursive: true));
      final input = File('${tempDir.path}/ai.png');
      await input.writeAsBytes(
        _pngWithText('parameters', 'ComfyUI workflow Seed: 123 Model: SDXL'),
      );
      final outputDir = Directory('${tempDir.path}/out');

      final flutterRoot = Platform.environment['FLUTTER_ROOT'];
      final dartExecutable =
          flutterRoot == null
              ? Platform.resolvedExecutable
              : '$flutterRoot/bin/cache/dart-sdk/bin/dart';

      final result = await Process.run(dartExecutable, [
        'bin/stript.dart',
        input.path,
        '--inspect-only',
        '-o',
        outputDir.path,
      ], workingDirectory: Directory.current.path);

      expect(result.exitCode, 0);
      expect(result.stdout, contains('Scan ai.png: AI generator metadata'));
      expect(result.stdout, contains('PNG tEXt:'));
      expect(result.stdout, contains('ComfyUI'));
      expect(outputDir.existsSync(), isFalse);
    },
  );
}

List<int> _pngWithText(String key, String value) {
  final src = img.Image(width: 2, height: 2);
  final png = img.encodePng(src);
  final iend = _findPngChunk(png, 'IEND');
  final data = latin1.encode('$key\u0000$value');
  final chunk = _pngChunk('tEXt', data);
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
