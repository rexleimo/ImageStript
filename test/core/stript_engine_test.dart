import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:stript/core/stript_engine.dart';
import 'package:stript/core/presets.dart';

void main() {
  group('StriptEngine', () {
    late StriptEngine engine;

    setUp(() {
      engine = StriptEngine(params: StriptParams.presetParams[Preset.standard]!);
    });

    test('processes image end-to-end', () async {
      final src = img.Image(width: 32, height: 32);
      for (int y = 0; y < 32; y++) {
        for (int x = 0; x < 32; x++) {
          src.setPixelRgba(x, y, (x * 8) % 256, (y * 8) % 256, 128, 255);
        }
      }
      final inputBytes = img.encodePng(src);
      final result = await engine.process(inputBytes);
      final decoded = img.decodeImage(result)!;
      expect(decoded.width, equals(32));
      expect(decoded.height, equals(32));
      expect(result[0], equals(0x89));
      expect(result[1], equals(0x50));
    });

    test('aggressive preset processes correctly', () async {
      final agg = StriptEngine(params: StriptParams.presetParams[Preset.aggressive]!);
      final src = img.Image(width: 16, height: 16);
      final result = await agg.process(img.encodePng(src));
      final decoded = img.decodeImage(result)!;
      expect(decoded.width, equals(16));
    });

    test('subtle preset processes correctly', () async {
      final sub = StriptEngine(params: StriptParams.presetParams[Preset.subtle]!);
      final src = img.Image(width: 16, height: 16);
      final result = await sub.process(img.encodePng(src));
      final decoded = img.decodeImage(result)!;
      expect(decoded.width, equals(16));
    });

    test('batch processes multiple images', () async {
      final images = List.generate(5, (i) {
        final src = img.Image(width: 4, height: 4);
        src.setPixelRgba(0, 0, i * 50, 100, 200, 255);
        return img.encodePng(src);
      });
      final results = await engine.processBatch(images);
      expect(results.length, equals(5));
      for (final r in results) {
        expect(r.outputBytes, isNotEmpty);
        expect(r.error, isNull);
      }
    });
  });
}
