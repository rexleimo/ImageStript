import 'package:flutter_test/flutter_test.dart';
import 'package:stript/app/stript_app.dart';

void main() {
  testWidgets('App renders home screen', (tester) async {
    await tester.pumpWidget(const StriptApp());
    expect(find.text('Stript'), findsOneWidget);
  });
}
