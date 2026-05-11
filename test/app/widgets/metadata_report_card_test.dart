import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stript/app/widgets/metadata_report_card.dart';
import 'package:stript/core/metadata_inspector.dart';

void main() {
  testWidgets('MetadataReportCard summarizes detected AI metadata', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MetadataReportCard(
            reports: const {
              'sample.png': MetadataReport([
                MetadataFinding(
                  container: 'PNG tEXt',
                  signal: 'Stable Diffusion prompt/parameters',
                  detail: 'Negative prompt',
                  snippet: 'Negative prompt: blur, Seed: 42',
                ),
              ]),
            },
          ),
        ),
      ),
    );

    expect(find.text('AI metadata scan'), findsOneWidget);
    expect(find.textContaining('sample.png'), findsOneWidget);
    expect(
      find.textContaining('Stable Diffusion prompt/parameters'),
      findsOneWidget,
    );
    expect(find.textContaining('PNG tEXt'), findsOneWidget);
    expect(find.textContaining('Negative prompt: blur'), findsOneWidget);
  });

  testWidgets('MetadataReportCard shows a clean state when no findings exist', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: MetadataReportCard(reports: {'clean.png': MetadataReport([])}),
        ),
      ),
    );

    expect(
      find.text('No embedded AI metadata signatures found.'),
      findsOneWidget,
    );
  });
}
