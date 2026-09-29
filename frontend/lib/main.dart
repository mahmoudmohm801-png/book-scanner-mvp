import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'models/book.dart';
import 'services/book_api_service.dart';
import 'services/ocr_service.dart';

void main() => runApp(const BookScannerApp());
class BookScannerApp extends StatelessWidget {
  const BookScannerApp({super.key, this.api});
  final BookApiService? api;
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Book Scanner', debugShowCheckedModeBanner: false,
    theme: ThemeData(useMaterial3: true, colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF236B4B)), scaffoldBackgroundColor: const Color(0xFFF7F7F2)),
    home: ScannerPage(api: api ?? BookApiService()),
  );
}
class ScannerPage extends StatefulWidget {
  const ScannerPage({super.key, required this.api});
  final BookApiService api;
  @override
  State<ScannerPage> createState() => _ScannerPageState();
}
class _ScannerPageState extends State<ScannerPage> {
  final _picker = ImagePicker(), _ocr = OcrService();
  final _query = TextEditingController();
  Uint8List? _image;
  List<Book> _books = [];
  bool _busy = false;
  String? _message;

  @override
  void dispose() { _query.dispose(); _ocr.dispose(); super.dispose(); }

  Future<void> _choose(ImageSource source) async {
    try {
      final file = await _picker.pickImage(source: source, imageQuality: 88, maxWidth: 1800);
      if (file == null) return;
      setState(() { _image = null; _message = null; });
      _image = await file.readAsBytes();
      if (mounted) setState(() {});
      await _scan(file);
    } catch (_) {
      if (mounted) setState(() => _message = 'Could not open this photo. Try again.');
    }
  }

  Future<void> _scan(XFile file) async {
    setState(() => _busy = true);
    try {
      final text = await _ocr.readCover(file);
      if (text.isEmpty) { setState(() => _message = 'No text found. Type the title below.'); }
      else { _query.text = text; await _search(text); }
    } on UnsupportedError catch (e) {
      setState(() => _message = e.message.toString());
    } on Exception {
      setState(() => _message = 'Could not read the cover. Type its title below.');
    } finally { if (mounted) setState(() => _busy = false); }
  }

  Future<void> _search([String? value]) async {
    final query = (value ?? _query.text).trim();
    if (query.isEmpty) { setState(() => _message = 'Enter a title or author to search.'); return; }
    FocusScope.of(context).unfocus();
    setState(() { _busy = true; _message = null; });
    try {
      final books = await widget.api.search(query);
      if (mounted) setState(() { _books = books; if (books.isEmpty) _message = 'No books found. Try another search.'; });
    } on BookApiException catch (e) {
      if (mounted) setState(() => _message = e.message);
    } finally { if (mounted) setState(() => _busy = false); }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(child: ListView(padding: const EdgeInsets.fromLTRB(22, 18, 22, 30), children: [
      Row(children: [
        const Icon(Icons.menu_book_rounded, color: Color(0xFF236B4B), size: 30),
        const SizedBox(width: 9),
        const Expanded(child: Text('Leaf & Lore', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18))),
        IconButton(tooltip: 'Start over', onPressed: () => setState(() { _image = null; _books = []; _message = null; _query.clear(); }), icon: const Icon(Icons.refresh_rounded)),
      ]),
      const SizedBox(height: 22),
      Text('A world of books,\\none scan away.', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800, height: 1.12)),
      const SizedBox(height: 8),
      const Text('Scan a cover or search by title to discover your next read.', style: TextStyle(color: Color(0xFF68736C))),
      const SizedBox(height: 22),
      Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: const Color(0xFFE8EFE7), borderRadius: BorderRadius.circular(22)), child: Column(children: [
        ClipRRect(borderRadius: BorderRadius.circular(16), child: Container(height: 185, width: double.infinity, color: const Color(0xFFD8E4D9), child: _image == null
          ? const Column(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(Icons.menu_book_rounded, size: 46), SizedBox(height: 8), Text('Your next favorite is waiting')])
          : Image.memory(_image!, fit: BoxFit.contain))),
        if (_busy) const Padding(padding: EdgeInsets.only(top: 12), child: LinearProgressIndicator()),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(child: OutlinedButton.icon(onPressed: _busy ? null : () => _choose(ImageSource.camera), icon: const Icon(Icons.photo_camera_outlined), label: const Text('Camera'))),
          const SizedBox(width: 8),
          Expanded(child: FilledButton.tonalIcon(onPressed: _busy ? null : () => _choose(ImageSource.gallery), icon: const Icon(Icons.photo_library_outlined), label: const Text('Choose photo'))),
        ]),
      ])),
      const SizedBox(height: 16),
      TextField(controller: _query, textInputAction: TextInputAction.search, onSubmitted: (_) => _search(), decoration: const InputDecoration(filled: true, fillColor: Colors.white, hintText: 'Title, author, or ISBN', prefixIcon: Icon(Icons.search_rounded), border: OutlineInputBorder(borderSide: BorderSide.none, borderRadius: BorderRadius.all(Radius.circular(15))))),
      const SizedBox(height: 10),
      FilledButton.icon(onPressed: _busy ? null : () => _search(), icon: _busy ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.auto_stories_outlined), label: Text(_busy ? 'Looking for your book…' : 'Find my book'), style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52))),
      if (_message != null) ...[const SizedBox(height: 12), Text(_message!, style: const TextStyle(color: Color(0xFF873B27)))],
      if (_books.isNotEmpty) ...[const SizedBox(height: 26), Text('Books we found', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)), const SizedBox(height: 10), ..._books.map(_bookCard)],
      if (_image == null && _books.isEmpty && _message == null) ...[const SizedBox(height: 24), const Text('How it works', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17)), const SizedBox(height: 8), const Text('1. Take a photo or choose a cover\\n2. Read its title on your device\\n3. Explore details and ratings')],
    ])),
  );

  Widget _bookCard(Book book) => Card(
    margin: const EdgeInsets.only(bottom: 10), color: Colors.white,
    child: ListTile(
      contentPadding: const EdgeInsets.all(12),
      leading: book.imageUrl == null ? const Icon(Icons.menu_book_rounded, size: 40) : Image.network(book.imageUrl!, width: 54, height: 76, fit: BoxFit.cover, errorBuilder: (context, error, stackTrace) => const Icon(Icons.menu_book_rounded, size: 40)),
      title: Text(book.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
      subtitle: Text(book.averageRating == null ? book.authorLabel : "${book.authorLabel}\\n★ ${book.averageRating!.toStringAsFixed(1)} (${book.ratingsCount})"),
      isThreeLine: book.averageRating != null,
      onTap: () => showModalBottomSheet<void>(context: context, showDragHandle: true, builder: (context) => SafeArea(child: Padding(padding: const EdgeInsets.all(22), child: SingleChildScrollView(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(book.title, style: Theme.of(context).textTheme.headlineSmall), const SizedBox(height: 8), Text(book.authorLabel), const SizedBox(height: 16), Text(book.description ?? 'No description available.')]))))),
    ),
  );
}