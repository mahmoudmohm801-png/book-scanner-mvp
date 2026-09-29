class Book {
  const Book({
    required this.id,
    required this.title,
    this.subtitle,
    this.authors = const [],
    this.description,
    this.publisher,
    this.publishedDate,
    this.pageCount,
    this.imageUrl,
    this.averageRating,
    this.ratingsCount = 0,
    this.price,
  });
  final String id, title;
  final String? subtitle, description, publisher, publishedDate, imageUrl;
  final List<String> authors;
  final int? pageCount;
  final double? averageRating;
  final int ratingsCount;
  final Map<String, dynamic>? price;
  String get authorLabel =>
      authors.isEmpty ? 'Author unknown' : authors.join(', ');
  factory Book.fromJson(Map<String, dynamic> json) {
    final rawPrice = json['price'];
    return Book(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Untitled',
      subtitle: json['subtitle']?.toString(),
      authors: (json['authors'] as List<dynamic>? ?? const [])
          .map((e) => e.toString())
          .toList(),
      description: json['description']?.toString(),
      publisher: json['publisher']?.toString(),
      publishedDate: json['publishedDate']?.toString(),
      pageCount: (json['pageCount'] as num?)?.toInt(),
      imageUrl: json['imageUrl']?.toString(),
      averageRating: (json['averageRating'] as num?)?.toDouble(),
      ratingsCount: (json['ratingsCount'] as num?)?.toInt() ?? 0,
      price: rawPrice is Map
          ? rawPrice.map((key, value) => MapEntry(key.toString(), value))
          : null,
    );
  }
}
