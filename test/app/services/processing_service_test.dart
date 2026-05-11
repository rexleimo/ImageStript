import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:stript/app/services/processing_service.dart';
import 'package:stript/core/presets.dart';
import 'package:stript/core/stript_engine.dart';

void main() {
  test(
    'inspectFile returns AI metadata findings for selected images',
    () async {
      final tempDir = await Directory.systemTemp.createTemp(
        'stript_service_test_',
      );
      addTearDown(() => tempDir.deleteSync(recursive: true));
      final file = File('${tempDir.path}/ai.png');
      await file.writeAsBytes(
        _pngWithText('parameters', 'ComfyUI workflow Seed: 123'),
      );

      final service = ProcessingService(
        const StriptEngine(params: StriptParams()),
      );

      final report = await service.inspectFile(file);

      expect(report.hasAiMetadata, isTrue);
      expect(report.summary, contains('AI generator metadata'));
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
    final length =
        (png[offset] << 24) |
        (png[offset + 1] << 16) |
        (png[offset + 2] << 8) |
        png[offset + 3];
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
