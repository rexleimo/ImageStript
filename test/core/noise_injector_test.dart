import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:stript/core/noise_injector.dart';

void main() {
  group('NoiseInjector', () {
    test('adds noise to approximately correct fraction of pixels', () {
      final src = img.Image(width: 100, height: 100);
      for (int y = 0; y < 100; y++) {
        for (int x = 0; x < 100; x++) {
          src.setPixelRgba(x, y, 128, 128, 128, 255);
        }
      }
      final srcBytes = img.encodePng(src);
      final result = NoiseInjector.inject(srcBytes, fraction: 0.5, strength: 1);
      final decoded = img.decodeImage(result)!;
      int changed = 0;
      for (int y = 0; y < 100; y++) {
        for (int x = 0; x < 100; x++) {
          final p = decoded.getPixel(x, y);
          if (p.r != 128 || p.g != 128 || p.b != 128) changed++;
        }
      }
      expect(changed, greaterThan(3000));
      expect(changed, lessThan(7000));
    });

    test('zero fraction produces no change', () {
      final src = img.Image(width: 10, height: 10);
      for (int y = 0; y < 10; y++) {
        for (int x = 0; x < 10; x++) {
          src.setPixelRgba(x, y, 100, 100, 100, 255);
        }
      }
      final srcBytes = img.encodePng(src);
      final result = NoiseInjector.inject(srcBytes, fraction: 0, strength: 5);
      final decoded = img.decodeImage(result)!;
      for (int y = 0; y < 10; y++) {
        for (int x = 0; x < 10; x++) {
          final p = decoded.getPixel(x, y);
          expect(p.r, equals(100));
          expect(p.g, equals(100));
        }
      }
    });

    test('pixels stay within 0-255 range', () {
      final src = img.Image(width: 1, height: 2);
      src.setPixelRgba(0, 0, 0, 0, 0, 255);
      src.setPixelRgba(0, 1, 255, 255, 255, 255);
      final srcBytes = img.encodePng(src);
      final result = NoiseInjector.inject(srcBytes, fraction: 1.0, strength: 2);
      final decoded = img.decodeImage(result)!;
      final p0 = decoded.getPixel(0, 0);
      final p1 = decoded.getPixel(0, 1);
      expect(p0.r, inInclusiveRange(0, 255));
      expect(p0.g, inInclusiveRange(0, 255));
      expect(p1.r, inInclusiveRange(0, 255));
      expect(p1.g, inInclusiveRange(0, 255));
    });
  });
}
