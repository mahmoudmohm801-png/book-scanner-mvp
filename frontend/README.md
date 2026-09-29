# Book Scanner Flutter app

Flutter client for Book Scanner MVP. Take or choose a book cover, read its text locally with Google ML Kit on Android/iOS, search the Express API, and review matching books.

From this frontend directory, run flutter pub get and then flutter run.

The API defaults to http://10.0.2.2:8000 on the Android emulator and http://localhost:8000 on web/desktop. For a physical phone, use the computer's LAN address with --dart-define=API_BASE_URL=http://YOUR_COMPUTER_LAN_IP:8000 and ensure both devices share Wi-Fi.

The Android app does not enable cleartext HTTP. To connect an Android device to a local HTTP backend, use HTTPS or add a debug-only network exception after approval. Do not enable cleartext traffic for release builds.

OCR runs on-device on Android/iOS; cover images are not uploaded. On web/desktop, type a title to search. The backend needs its Google Books key in backend/.env.

Verify with flutter analyze and flutter test. An Android debug APK also needs the SDK NDK version 28.2.13676358 installed.
