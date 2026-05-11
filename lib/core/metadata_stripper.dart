import 'dart:typed_data';
import 'package:image/image.dart' as img;

class MetadataStripper {
  /// Decode image, flatten to opaque RGB, drop all metadata.
  /// Returns clean PNG bytes with no EXIF, ICC profile, or text chunks.
  static Uint8List strip(Uint8List bytes) {
    final decoded = img.decodeImage(bytes);
    if (decoded == null) {
      throw ArgumentError('Unsupported or corrupt image');
    }

    final clean = img.Image(width: decoded.width, height: decoded.height);
    for (int y = 0; y < decoded.height; y++) {
      for (int x = 0; x < decoded.width; x++) {
        final p = decoded.getPixel(x, y);
        if (decoded.numChannels >= 4) {
          final a = p.a / 255.0;
          final r = (p.r * a + 255 * (1 - a)).round();
          final g = (p.g * a + 255 * (1 - a)).round();
          final b = (p.b * a + 255 * (1 - a)).round();
          clean.setPixelRgba(x, y, r, g, b, 255);
        } else {
          clean.setPixelRgba(x, y, p.r, p.g, p.b, 255);
        }
      }
    }
    return img.encodePng(clean);
  }
}
