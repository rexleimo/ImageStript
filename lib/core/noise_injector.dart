import 'dart:math';
import 'dart:typed_data';
import 'package:image/image.dart' as img;

class NoiseInjector {
  /// Add ±strength noise to [fraction] of pixels.
  static Uint8List inject(
    Uint8List bytes, {
    double fraction = 0.03,
    int strength = 1,
  }) {
    if (fraction <= 0) return Uint8List.fromList(bytes);

    final decoded = img.decodeImage(bytes);
    if (decoded == null) {
      throw ArgumentError('Unsupported or corrupt image');
    }

    final rng = Random.secure();
    final numChannels = decoded.numChannels;

    for (int y = 0; y < decoded.height; y++) {
      for (int x = 0; x < decoded.width; x++) {
        if (rng.nextDouble() >= fraction) continue;
        final p = decoded.getPixel(x, y);
        final dr = rng.nextInt(strength * 2 + 1) - strength;
        final dg = rng.nextInt(strength * 2 + 1) - strength;
        final db = rng.nextInt(strength * 2 + 1) - strength;
        final r = (p.r + dr).clamp(0, 255);
        final g = (p.g + dg).clamp(0, 255);
        final b = (p.b + db).clamp(0, 255);
        decoded.setPixelRgba(x, y, r, g, b, numChannels >= 4 ? p.a : 255);
      }
    }
    return img.encodePng(decoded);
  }
}
