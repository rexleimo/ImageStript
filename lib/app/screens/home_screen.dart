import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:stript/app/widgets/drop_zone.dart';
import 'package:stript/app/widgets/image_preview.dart';
import 'package:stript/app/widgets/parameter_sliders.dart';
import 'package:stript/app/services/processing_service.dart';
import 'package:stript/core/stript_engine.dart';
import 'package:stript/core/presets.dart';
import 'package:path_provider/path_provider.dart';
import 'package:stript/app/screens/batch_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<File> _files = [];
  StriptParams _params = StriptParams.presetParams[Preset.standard]!;
  Map<String, Uint8List?> _results = {};
  Set<String> _processing = {};
  late ProcessingService _service;

  @override
  void initState() {
    super.initState();
    _service = ProcessingService(StriptEngine(params: _params));
  }

  void _onFilesAdded(List<File> newFiles) {
    setState(() => _files = [..._files, ...newFiles]);
  }

  void _onParamsChanged(StriptParams newParams) {
    setState(() {
      _params = newParams;
      _service = ProcessingService(StriptEngine(params: newParams));
    });
  }

  Future<void> _processAll() async {
    if (_files.length > 1) {
      await Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => BatchScreen(files: _files, params: _params)),
      );
      return;
    }
    setState(() => _processing = _files.map((f) => f.path).toSet());
    for (final file in _files) {
      try {
        final result = await _service.processFile(file);
        setState(() {
          _results[file.path] = result;
          _processing.remove(file.path);
        });
      } catch (e) {
        setState(() => _processing.remove(file.path));
      }
    }
  }

  Future<void> _saveAll() async {
    final dir = await getApplicationDocumentsDirectory();
    final outDir = Directory('${dir.path}/stript_output');
    if (!outDir.existsSync()) outDir.createSync(recursive: true);
    for (final entry in _results.entries) {
      if (entry.value != null) {
        final name = entry.key.split('/').last.split('.').first;
        await File('${outDir.path}/$name.png').writeAsBytes(entry.value!);
      }
    }
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Saved to ${outDir.path}')));
    }
  }

  File? get _selectedFile => _files.isNotEmpty ? _files.first : null;

  @override
  Widget build(BuildContext context) {
    final hasResults = _results.values.any((r) => r != null);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Stript'),
        centerTitle: false,
        actions: [
          if (_files.isNotEmpty)
            TextButton.icon(
              onPressed: () => setState(() { _files = []; _results = {}; }),
              icon: const Icon(Icons.clear_all),
              label: const Text('Clear'),
            ),
          IconButton(icon: const Icon(Icons.settings), onPressed: () {}),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            DropZone(files: _files, onFilesAdded: _onFilesAdded),
            const SizedBox(height: 16),
            ParameterSliders(params: _params, onChanged: _onParamsChanged),
            const SizedBox(height: 16),
            if (_selectedFile != null)
              Expanded(
                child: ImagePreview(
                  originalFile: _selectedFile!,
                  processedBytes: _results[_selectedFile!.path],
                  isProcessing: _processing.contains(_selectedFile!.path),
                ),
              ),
            if (_files.isNotEmpty) ...[
              const SizedBox(height: 16),
              Row(
                children: [
                  FilledButton.icon(
                    onPressed: _processing.isNotEmpty ? null : _processAll,
                    icon: const Icon(Icons.auto_fix_high),
                    label: Text('Process All (${_files.length})'),
                  ),
                  const SizedBox(width: 12),
                  if (hasResults)
                    OutlinedButton.icon(
                      onPressed: _saveAll,
                      icon: const Icon(Icons.folder_open),
                      label: const Text('Save All'),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
