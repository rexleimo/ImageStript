import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:stript/core/reencoder.dart';

void main() {
  group('Reencoder', () {
    test('round-trips through JPEG and returns clean PNG', () {
      final src = img.Image(width: 16, height: 16);
      for (int x = 0; x < 16; x++) {
        src.setPixelRgba(x, 0, 255, 0, 0, 255);
      }
      final srcBytes = img.encodePng(src);
      final result = Reencoder.reencode(srcBytes, quality: 85);
      final decoded = img.decodeImage(result)!;
      expect(decoded.width, equals(16));
      expect(decoded.height, equals(16));
      expect(result.length, greaterThan(0));
    });

    test('quality 100 skips re-encode', () {
      final src = img.Image(width: 4, height: 4);
      final srcBytes = img.encodePng(src);
      final result = Reencoder.reencode(srcBytes, quality: 100);
      final decoded = img.decodeImage(result)!;
      expect(decoded.width, equals(4));
    });

    test('quality 0 produces smaller output than quality 90', () {
      final src = img.Image(width: 100, height: 100);
      for (int y = 0; y < 100; y++) {
        for (int x = 0; x < 100; x++) {
          src.setPixelRgba(x, y, x % 256, y % 256, (x + y) % 256, 255);
        }
      }
      final srcBytes = img.encodePng(src);
      final highQ = Reencoder.reencode(Uint8List.fromList(srcBytes), quality: 90);
      final lowQ = Reencoder.reencode(Uint8List.fromList(srcBytes), quality: 10);
      expect(lowQ.length, lessThan(highQ.length));
    });
  });
}
