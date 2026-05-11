import 'package:flutter/material.dart';
import 'package:stript/app/stript_app.dart';
import 'package:stript/desktop/window_manager.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await DesktopWindowManager.init();
  runApp(const StriptApp());
}
