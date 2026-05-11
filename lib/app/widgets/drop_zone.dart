import 'dart:io';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';

class DropZone extends StatelessWidget {
  final List<File> files;
  final ValueChanged<List<File>> onFilesAdded;

  const DropZone({super.key, required this.files, required this.onFilesAdded});

  Future<void> _pickFiles() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'tif'],
      allowMultiple: true,
    );
    if (result != null) {
      onFilesAdded(result.paths.whereType<String>().map((p) => File(p)).toList());
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return GestureDetector(
      onTap: _pickFiles,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 48),
        decoration: BoxDecoration(
          border: Border.all(color: theme.colorScheme.outline.withValues(alpha: 0.5), width: 2),
          borderRadius: BorderRadius.circular(16),
          color: theme.colorScheme.surfaceContainerLow,
        ),
        child: Column(
          children: [
            Icon(Icons.cloud_upload_outlined, size: 48, color: theme.colorScheme.primary),
            const SizedBox(height: 16),
            Text(
              files.isEmpty ? 'Drop images here or click to browse' : '${files.length} file(s) selected — click to change',
              style: theme.textTheme.bodyLarge?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
          ],
        ),
      ),
    );
  }
}
