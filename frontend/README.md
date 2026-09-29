# Book Scanner Flutter app

Flutter client for Book Scanner MVP. Take or choose a book cover, read its text locally with Google ML Kit on Android/iOS, search the Express API, and review matching books.

Run from this frontend directory with flutter pub get, then flutter run. The Android emulator uses http://10.0.2.2:8000. Other targets default to http://localhost:8000. For a physical phone, pass --dart-define=API_BASE_URL=http://YOUR_COMPUTER_LAN_IP:8000 and make sure both devices share Wi-Fi.

OCR runs on-device; cover photos are not uploaded. On web/desktop, use typed title search. The backend needs its Google Books key in backend/.env.

Verify with flutter analyze and flutter test.