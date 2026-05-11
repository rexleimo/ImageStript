import 'dart:typed_data';
import 'package:image/image.dart' as img;

class Reencoder {
  /// Round-trip through JPEG at [quality], output as clean PNG.
  /// JPEG compression removes hidden data in file structure.
  /// quality=100 skips re-encoding entirely.
  static Uint8List reencode(Uint8List bytes, {int quality = 97}) {
    if (quality >= 100) return Uint8List.fromList(bytes);

    final decoded = img.decodeImage(bytes);
    if (decoded == null) {
      throw ArgumentError('Unsupported or corrupt image');
    }

    final jpegBytes = img.encodeJpg(decoded, quality: quality);
    final redecoded = img.decodeImage(jpegBytes);
    if (redecoded == null) {
      throw StateError('Failed to re-decode JPEG');
    }
    return img.encodePng(redecoded);
  }
}
