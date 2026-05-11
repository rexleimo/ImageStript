import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';

class ImagePreview extends StatelessWidget {
  final File originalFile;
  final Uint8List? processedBytes;
  final bool isProcessing;

  const ImagePreview({
    super.key,
    required this.originalFile,
    this.processedBytes,
    this.isProcessing = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Expanded(child: _buildPanel(context, theme, 'Before', FileImage(originalFile))),
        const SizedBox(width: 16),
        Expanded(
          child: _buildPanel(context, theme, 'After', processedBytes != null ? MemoryImage(processedBytes!) : null, isProcessing: isProcessing),
        ),
      ],
    );
  }

  Widget _buildPanel(BuildContext context, ThemeData theme, String label, ImageProvider? image, {bool isProcessing = false}) {
    return Column(
      children: [
        Text(label, style: theme.textTheme.labelLarge),
        const SizedBox(height: 8),
        Expanded(
          child: Container(
            decoration: BoxDecoration(
              border: Border.all(color: theme.colorScheme.outlineVariant),
              borderRadius: BorderRadius.circular(8),
            ),
            child: isProcessing
                ? const Center(child: CircularProgressIndicator())
                : image != null
                    ? ClipRRect(borderRadius: BorderRadius.circular(7), child: Image(image: image, fit: BoxFit.contain))
                    : Center(child: Icon(Icons.image_outlined, size: 48, color: theme.colorScheme.outlineVariant)),
          ),
        ),
      ],
    );
  }
}
