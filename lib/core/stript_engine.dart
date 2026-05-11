import 'dart:typed_data';
import 'package:stript/core/metadata_stripper.dart';
import 'package:stript/core/noise_injector.dart';
import 'package:stript/core/resize_perturbator.dart';
import 'package:stript/core/reencoder.dart';
import 'package:stript/core/presets.dart';

class ProcessResult {
  final String? fileName;
  final Uint8List outputBytes;
  final String? error;

  const ProcessResult({
    this.fileName,
    required this.outputBytes,
    this.error,
  });

  bool get isSuccess => error == null;
}

class StriptEngine {
  final StriptParams params;

  const StriptEngine({required this.params});

  /// Process a single image through the full pipeline.
  Future<Uint8List> process(Uint8List inputBytes) async {
    var result = MetadataStripper.strip(inputBytes);

    if (params.resizeScale < 1.0) {
      result = ResizePerturbator.perturb(result, scale: params.resizeScale);
    }

    if (params.noiseFraction > 0) {
      result = NoiseInjector.inject(
        result,
        fraction: params.noiseFraction,
        strength: params.noiseStrength,
      );
    }

    result = Reencoder.reencode(result, quality: params.jpegQuality);
    return result;
  }

  /// Process files in batch, returning results in order.
  Future<List<ProcessResult>> processBatch(List<Uint8List> files) async {
    final results = <ProcessResult>[];
    for (final file in files) {
      try {
        final output = await process(file);
        results.add(ProcessResult(outputBytes: output));
      } catch (e) {
        results.add(ProcessResult(outputBytes: Uint8List(0), error: e.toString()));
      }
    }
    return results;
  }
}
