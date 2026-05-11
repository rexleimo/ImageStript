import 'dart:io';
import 'dart:typed_data';
import 'package:stript/core/metadata_inspector.dart';
import 'package:stript/core/stript_engine.dart';

class ProcessingService {
  final StriptEngine engine;

  ProcessingService(this.engine);

  Future<Uint8List> processFile(File file) async {
    final bytes = await file.readAsBytes();
    return engine.process(bytes);
  }

  Future<MetadataReport> inspectFile(File file) async {
    final bytes = await file.readAsBytes();
    return MetadataInspector.inspect(bytes);
  }

  Future<Map<String, Uint8List>> processBatch(List<File> files) async {
    final results = <String, Uint8List>{};
    for (final file in files) {
      final output = await processFile(file);
      results[file.path] = output;
    }
    return results;
  }

  Future<void> saveResult(Uint8List bytes, String outputPath) async {
    final file = File(outputPath);
    await file.writeAsBytes(bytes);
  }
}
