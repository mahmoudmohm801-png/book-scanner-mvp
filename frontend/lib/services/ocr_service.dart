import 'package:flutter/foundation.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import 'package:image_picker/image_picker.dart';
class OcrService {
  final TextRecognizer _recognizer = TextRecognizer();
  Future<String> readCover(XFile image) async {
    if (kIsWeb || (defaultTargetPlatform != TargetPlatform.android && defaultTargetPlatform != TargetPlatform.iOS)) {
      throw UnsupportedError('Cover OCR is available on Android and iOS. Type the title to search.');
    }
    final result = await _recognizer.processImage(InputImage.fromFilePath(image.path));
    return result.text.split('\n').map((s) => s.trim()).where((s) => s.isNotEmpty).take(5).join(' ');
  }
  Future<void> dispose() => _recognizer.close();
}