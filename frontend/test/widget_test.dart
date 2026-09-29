import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_app/main.dart';

void main() {
  testWidgets('Book Scanner home presents scan and search actions', (
    tester,
  ) async {
    await tester.pumpWidget(const BookScannerApp());
    expect(find.text('Leaf & Lore'), findsOneWidget);
    expect(find.text('Camera'), findsOneWidget);
    expect(find.text('Choose photo'), findsOneWidget);
    expect(find.text('Find my book'), findsOneWidget);
  });
}
