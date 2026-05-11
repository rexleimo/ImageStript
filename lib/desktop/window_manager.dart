import 'dart:io' show Platform;
import 'dart:ui';
import 'package:window_manager/window_manager.dart';

class DesktopWindowManager {
  static Future<void> init() async {
    if (!_isDesktop) return;
    await windowManager.ensureInitialized();
    final options = WindowOptions(
      size: const Size(1024, 720),
      minimumSize: const Size(800, 600),
      center: true,
      title: 'Stript',
    );
    await windowManager.waitUntilReadyToShow(options, () async {
      await windowManager.show();
      await windowManager.focus();
    });
  }

  static bool get _isDesktop => Platform.isMacOS || Platform.isWindows || Platform.isLinux;
}
