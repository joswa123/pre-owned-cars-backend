# Flutter FCM Push Notifications Setup Guide

This guide explains how to set up Firebase Cloud Messaging (FCM) on the Flutter app to receive push notifications from the Node.js backend.

## 1. Firebase Project Setup

1. Place your `google-services.json` file inside `android/app/` in your Flutter project.
2. Ensure you have added the `google-services` plugin to your Android project.
   
   In `android/build.gradle`:
   ```gradle
   buildscript {
       dependencies {
           // Add this line
           classpath 'com.google.gms:google-services:4.4.1' // or latest version
       }
   }
   ```

   In `android/app/build.gradle`:
   ```gradle
   // Add this at the bottom of the file
   apply plugin: 'com.google.gms.google-services'
   ```

## 2. Dependencies

Add the necessary dependencies to your `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  firebase_core: ^latest_version
  firebase_messaging: ^latest_version
  flutter_local_notifications: ^latest_version
```

Run `flutter pub get`.

## 3. Flutter Initialization & Token Handling

In your `main.dart` or an initialization service, set up Firebase and FCM.
When the user logs in, retrieve the token and send it to the backend via the `device_token` field.

```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter/material.dart';
import 'dart:io';

// Background message handler must be a top-level function
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  print("Handling a background message: ${message.messageId}");
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  
  runApp(MyApp());
}

class PushNotificationService {
  final FirebaseMessaging _fcm = FirebaseMessaging.instance;

  Future<void> init() async {
    // Request permission (especially for iOS)
    NotificationSettings settings = await _fcm.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      print('User granted permission');
      
      // Get the token
      String? token = await _fcm.getToken();
      print("FirebaseMessaging token: $token");
      
      // TODO: Send this token to backend via Login/Register API
      // e.g. sendToBackend(token, getDeviceType());

      // Listen for token refresh
      _fcm.onTokenRefresh.listen((newToken) {
        // TODO: Send new token to backend
        print("Token refreshed: $newToken");
      });

      // Handle foreground messages
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        print('Got a message whilst in the foreground!');
        print('Message data: ${message.data}');

        if (message.notification != null) {
          print('Message also contained a notification: ${message.notification}');
          // Optionally display a local notification here using flutter_local_notifications
        }
      });
    } else {
      print('User declined or has not accepted permission');
    }
  }
  
  String getDeviceType() {
    if (Platform.isAndroid) return 'android';
    if (Platform.isIOS) return 'ios';
    return 'web';
  }
}
```

## 4. Backend Integration

When calling the backend `POST /api/v1/auth/login` or `POST /api/v1/auth/register`, include the token in the request body:

```json
{
  "phone_number": "+919876543210",
  "password": "yourpassword",
  "device_token": "fcm_token_from_flutter_here",
  "device_type": "android" 
}
```

If the token changes later, you may need a separate endpoint to update it or update it on the next login/OTP verification.

## 5. Testing

1. Run the Flutter app on a real device.
2. Ensure you have registered/logged in and the `device_token` is saved in the backend database.
3. On the backend, trigger a push notification (e.g., using `scripts/test-push.js`).
4. You should see the notification pop up on the device or log in the console (if in foreground).
