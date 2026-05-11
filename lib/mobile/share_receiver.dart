import 'dart:io';

/// Receives shared images from other apps on mobile.
/// On iOS, invoked via Share Extension / NSItemProvider.
/// On Android, invoked via intent-filter with image/* MIME type.
class ShareReceiver {
  /// Parse shared files from intent/extension data.
  static List<File> parseSharedFiles(Map<String, dynamic> data) {
    final paths = <String>[];
    if (data.containsKey('clipData')) {
      paths.addAll(List<String>.from(data['clipData']));
    }
    if (data.containsKey('attachments')) {
      paths.addAll(List<String>.from(data['attachments']));
    }
    return paths.map((p) => File(p)).toList();
  }
}
