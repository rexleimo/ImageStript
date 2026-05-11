import 'dart:io';
import 'dart:typed_data';
import 'package:args/args.dart';
import 'package:stript/core/stript_engine.dart';
import 'package:stript/core/presets.dart';

const supportedExtensions = {'.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff', '.tif'};

void main(List<String> args) async {
  final parser = ArgParser()
    ..addOption('output', abbr: 'o', help: 'Output file or directory')
    ..addOption('noise', defaultsTo: '0.03', help: 'Noise fraction (0.0-1.0)')
    ..addOption('strength', defaultsTo: '1', help: 'Noise strength')
    ..addOption('resize', defaultsTo: '0.998', help: 'Resize perturbation scale')
    ..addOption('jpeg', defaultsTo: '97', help: 'JPEG re-encode quality (0-100)')
    ..addFlag('aggressive', help: 'Use aggressive preset')
    ..addFlag('help', abbr: 'h', help: 'Show usage', negatable: false);

  final results = parser.parse(args);

  if (results['help'] || results.rest.isEmpty) {
    print('Stript — Remove invisible AI watermarks from images');
    print('Usage: stript <path> [options]');
    print(parser.usage);
    exit(0);
  }

  final params = results['aggressive']
      ? StriptParams.presetParams[Preset.aggressive]!
      : StriptParams(
          noiseFraction: double.parse(results['noise']),
          noiseStrength: int.parse(results['strength']),
          resizeScale: double.parse(results['resize']),
          jpegQuality: int.parse(results['jpeg']),
        );

  final engine = StriptEngine(params: params);
  final inputPath = results.rest.first;

  // Handle stdin pipe
  if (inputPath == '-') {
    final bytes = Uint8List.fromList(await stdin.first);
    final output = await engine.process(bytes);
    stdout.add(output);
    return;
  }

  final srcPath = Directory(inputPath);
  if (!srcPath.existsSync()) {
    stderr.writeln('Error: path does not exist: $inputPath');
    exit(1);
  }

  // Collect files
  List<File> files;
  if (FileSystemEntity.isFileSync(inputPath)) {
    files = [File(inputPath)];
  } else {
    files = srcPath
        .listSync()
        .whereType<File>()
        .where((f) {
          final ext = f.path.toLowerCase();
          final dot = ext.lastIndexOf('.');
          if (dot == -1) return false;
          return supportedExtensions.contains(ext.substring(dot));
        })
        .toList()
      ..sort((a, b) => a.path.compareTo(b.path));
  }

  if (files.isEmpty) {
    print('No supported image files found.');
    exit(0);
  }

  // Determine output directory
  String outDir;
  if (results['output'] != null) {
    outDir = results['output'];
  } else if (files.length == 1) {
    outDir = '${files.first.parent.path}/output';
  } else {
    outDir = '$inputPath/output';
  }
  Directory(outDir).createSync(recursive: true);

  print('Stript — Processing ${files.length} image(s)...');
  print('  Noise: ${(params.noiseFraction * 100).toStringAsFixed(0)}% of pixels ±${params.noiseStrength}');
  print('  Resize perturbation: ${params.resizeScale}');
  print('  JPEG re-encode quality: ${params.jpegQuality}');
  print('  Output: $outDir');
  print('');

  for (final f in files) {
    final name = f.path.split('/').last.split('.').first;
    final dst = File('$outDir/$name.png');
    try {
      final inputBytes = await f.readAsBytes();
      final output = await engine.process(inputBytes);
      await dst.writeAsBytes(output);
      print('  OK  ${f.path.split('/').last}  →  ${dst.path.split('/').last}');
    } catch (e) {
      print('  FAIL  ${f.path.split('/').last}: $e');
    }
  }

  print('\nDone. ${files.length} image(s) written to $outDir');
}
