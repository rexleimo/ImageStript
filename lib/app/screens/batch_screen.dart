import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:stript/core/presets.dart';
import 'package:stript/core/stript_engine.dart';
import 'package:path_provider/path_provider.dart';

class BatchResult {
  final String fileName;
  final Uint8List? output;
  final String? error;

  const BatchResult({required this.fileName, this.output, this.error});
  bool get isSuccess => error == null;
}

class BatchScreen extends StatefulWidget {
  final List<File> files;
  final StriptParams params;

  const BatchScreen({super.key, required this.files, required this.params});

  @override
  State<BatchScreen> createState() => _BatchScreenState();
}

class _BatchScreenState extends State<BatchScreen> {
  final List<BatchResult> _results = [];
  bool _running = false;
  int _current = 0;

  @override
  void initState() {
    super.initState();
    _start();
  }

  Future<void> _start() async {
    setState(() => _running = true);
    final engine = StriptEngine(params: widget.params);
    for (int i = 0; i < widget.files.length; i++) {
      setState(() => _current = i + 1);
      try {
        final bytes = await widget.files[i].readAsBytes();
        final output = await engine.process(bytes);
        setState(() {
          _results.add(BatchResult(fileName: widget.files[i].path.split('/').last, output: output));
        });
      } catch (e) {
        setState(() {
          _results.add(BatchResult(fileName: widget.files[i].path.split('/').last, error: e.toString()));
        });
      }
    }
    setState(() => _running = false);
  }

  Future<void> _saveAll() async {
    final dir = await getApplicationDocumentsDirectory();
    final outDir = Directory('${dir.path}/stript_batch');
    if (!outDir.existsSync()) outDir.createSync(recursive: true);
    for (final r in _results.where((r) => r.isSuccess)) {
      final name = r.fileName.split('.').first;
      await File('${outDir.path}/$name.png').writeAsBytes(r.output!);
    }
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Saved to ${outDir.path}')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final successCount = _results.where((r) => r.isSuccess).length;
    return Scaffold(
      appBar: AppBar(title: Text('Batch ($_current/${widget.files.length})')),
      body: ListView.builder(
        itemCount: _results.length,
        itemBuilder: (context, index) {
          final r = _results[index];
          return ListTile(
            leading: Icon(r.isSuccess ? Icons.check_circle : Icons.error, color: r.isSuccess ? Colors.green : Colors.red),
            title: Text(r.fileName),
            subtitle: r.error != null ? Text(r.error!) : null,
          );
        },
      ),
      floatingActionButton: successCount > 0 && !_running
          ? FloatingActionButton.extended(
              onPressed: _saveAll,
              icon: const Icon(Icons.save),
              label: Text('Save $successCount'),
            )
          : null,
    );
  }
}
