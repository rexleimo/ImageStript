import 'package:flutter/material.dart';
import 'package:stript/app/screens/home_screen.dart';

class StriptApp extends StatelessWidget {
  const StriptApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Stript',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: Colors.indigo,
        useMaterial3: true,
        brightness: Brightness.light,
      ),
      darkTheme: ThemeData(
        colorSchemeSeed: Colors.indigo,
        useMaterial3: true,
        brightness: Brightness.dark,
      ),
      themeMode: ThemeMode.system,
      home: const HomeScreen(),
    );
  }
}
