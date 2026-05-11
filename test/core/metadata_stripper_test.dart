import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:stript/core/metadata_stripper.dart';

void main() {
  group('MetadataStripper', () {
    test('strips EXIF from JPEG', () {
      final src = img.Image(width: 4, height: 4);
      final jpegBytes = img.encodeJpg(src, quality: 100);
      final stripped = MetadataStripper.strip(jpegBytes);
      final decoded = img.decodeImage(stripped)!;
      expect(decoded.width, equals(4));
      expect(decoded.height, equals(4));
    });

    test('strips PNG text chunks', () {
      final src = img.Image(width: 8, height: 8);
      final pngBytes = img.encodePng(src);
      final stripped = MetadataStripper.strip(pngBytes);
      final decoded = img.decodeImage(stripped)!;
      expect(decoded.width, equals(8));
      expect(decoded.height, equals(8));
    });

    test('converts RGBA to RGB', () {
      final src = img.Image(width: 2, height: 2, numChannels: 4);
      src.setPixelRgba(0, 0, 255, 0, 0, 128);
      final rgbaBytes = img.encodePng(src);
      final stripped = MetadataStripper.strip(rgbaBytes);
      final decoded = img.decodeImage(stripped)!;
      expect(decoded.numChannels, equals(3));
    });
  });
}
