import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:stript/core/resize_perturbator.dart';

void main() {
  group('ResizePerturbator', () {
    test('returns original image when scale is 1.0', () {
      final src = img.Image(width: 100, height: 50);
      final srcBytes = img.encodePng(src);
      final result = ResizePerturbator.perturb(srcBytes, scale: 1.0);
      final decoded = img.decodeImage(result)!;
      expect(decoded.width, equals(100));
      expect(decoded.height, equals(50));
    });

    test('shrinks and restores to original dimensions', () {
      final src = img.Image(width: 100, height: 100);
      for (int x = 0; x < 100; x++) {
        src.setPixelRgba(x, x, 255, 0, 0, 255);
      }
      final srcBytes = img.encodePng(src);
      final result = ResizePerturbator.perturb(srcBytes, scale: 0.95);
      final decoded = img.decodeImage(result)!;
      expect(decoded.width, equals(100));
      expect(decoded.height, equals(100));
      final p = decoded.getPixel(50, 50);
      expect(p.r, greaterThan(200));
    });

    test('handles non-square images', () {
      final src = img.Image(width: 200, height: 50);
      final srcBytes = img.encodePng(src);
      final result = ResizePerturbator.perturb(srcBytes, scale: 0.9);
      final decoded = img.decodeImage(result)!;
      expect(decoded.width, equals(200));
      expect(decoded.height, equals(50));
    });
  });
}
