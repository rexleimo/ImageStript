import 'dart:typed_data';
import 'package:image/image.dart' as img;

class ResizePerturbator {
  /// Shrink image by [scale], then restore to original size.
  /// This breaks spatial-domain watermarks that rely on precise pixel alignment.
  static Uint8List perturb(Uint8List bytes, {double scale = 0.998}) {
    if (scale >= 1.0) return Uint8List.fromList(bytes);

    final decoded = img.decodeImage(bytes);
    if (decoded == null) {
      throw ArgumentError('Unsupported or corrupt image');
    }

    final w = decoded.width;
    final h = decoded.height;
    final smallW = (w * scale).round().clamp(1, w);
    final smallH = (h * scale).round().clamp(1, h);

    final small = img.copyResize(decoded, width: smallW, height: smallH);
    final restored = img.copyResize(small, width: w, height: h);
    return img.encodePng(restored);
  }
}
