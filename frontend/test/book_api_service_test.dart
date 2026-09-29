import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:flutter_app/services/book_api_service.dart';

void main() {
  test('search parses the normalized backend response', () async {
    final client = MockClient((request) async {
      expect(request.method, 'POST');
      expect(request.url.path, '/api/v1/books/search');
      expect(jsonDecode(request.body), {'query': 'Dune', 'maxResults': 20});
      return http.Response(jsonEncode({
        'success': true,
        'data': {
          'totalItems': 1,
          'books': [
            {
              'id': 'dune-1',
              'title': 'Dune',
              'authors': ['Frank Herbert'],
              'averageRating': 4.5,
              'ratingsCount': 12,
            }
          ],
        },
      }), 200);
    });
    final books = await BookApiService(
      client: client,
      baseUrl: 'http://example.test',
    ).search('Dune');

    expect(books, hasLength(1));
    expect(books.single.title, 'Dune');
    expect(books.single.authorLabel, 'Frank Herbert');
    expect(books.single.averageRating, 4.5);
  });

  test('book details calls the backend details route', () async {
    final client = MockClient((request) async {
      expect(request.method, 'GET');
      expect(request.url.path, '/api/v1/books/volume-1');
      return http.Response(jsonEncode({
        'success': true,
        'data': {
          'id': 'volume-1',
          'title': 'The Left Hand of Darkness',
          'authors': ['Ursula K. Le Guin'],
          'description': 'A science fiction novel.',
        },
      }), 200);
    });
    final book = await BookApiService(
      client: client,
      baseUrl: 'http://example.test',
    ).getBook('volume-1');

    expect(book.title, 'The Left Hand of Darkness');
    expect(book.description, 'A science fiction novel.');
  });

  test('API errors expose the backend message', () async {
    final client = MockClient((_) async => http.Response(jsonEncode({
          'success': false,
          'error': {'code': 'VALIDATION_ERROR', 'message': 'query is required'},
        }), 400));
    final api = BookApiService(client: client, baseUrl: 'http://example.test');

    expect(api.search(''), throwsA(isA<BookApiException>().having(
      (error) => error.message,
      'message',
      'query is required',
    )));
  });
}