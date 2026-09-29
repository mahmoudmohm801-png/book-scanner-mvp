import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/book.dart';
class BookApiException implements Exception {
  const BookApiException(this.message);
  final String message;
  @override
  String toString() => message;
}
class BookApiService {
  BookApiService({http.Client? client, String? baseUrl})
      : _client = client ?? http.Client(),
        baseUrl = (baseUrl ?? const String.fromEnvironment('API_BASE_URL')).isNotEmpty
            ? (baseUrl ?? const String.fromEnvironment('API_BASE_URL'))
            : defaultBaseUrl;
  final http.Client _client;
  final String baseUrl;
  static String get defaultBaseUrl => defaultTargetPlatform == TargetPlatform.android
      ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
  Future<List<Book>> search(String query) async {
    final request = http.Request('POST', Uri.parse(baseUrl).resolve('/api/v1/books/search'))
      ..headers['Content-Type'] = 'application/json'
      ..headers['Accept'] = 'application/json'
      ..body = jsonEncode({'query': query, 'maxResults': 20});
    final data = await _request(request);
    final result = data['data'] as Map<String, dynamic>? ?? const {};
    return (result['books'] as List<dynamic>? ?? const []).whereType<Map<String, dynamic>>().map(Book.fromJson).toList();
  }
  Future<Book> getBook(String id) async {
    final baseUri = Uri.parse(baseUrl);
    final detailsUri = baseUri.replace(pathSegments: [...baseUri.pathSegments, 'api', 'v1', 'books', id]);
    final request = http.Request('GET', detailsUri)..headers['Accept'] = 'application/json';
    final data = await _request(request);
    final book = data['data'];
    if (book is! Map<String, dynamic>) throw const BookApiException('The server returned an invalid book.');
    return Book.fromJson(book);
  }
  Future<Map<String, dynamic>> _request(http.Request request) async {
    try {
      final response = await http.Response.fromStream(await _client.send(request).timeout(const Duration(seconds: 20)));
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode < 200 || response.statusCode >= 300) {
        final error = data['error'];
        throw BookApiException(error is Map ? error['message'].toString() : 'Book request failed.');
      }
      return data;
    } on BookApiException { rethrow; } on Exception {
      throw const BookApiException('Cannot reach API. Check the server and API address.');
    }
  }
}