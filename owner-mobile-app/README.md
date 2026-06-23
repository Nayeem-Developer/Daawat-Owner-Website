# Daawat Owner Mobile App

React Native CLI owner app for Daawat, wired to the live backend at `https://daawat-backend.onrender.com`.

## Commands

```bash
npm install
npx react-native start --reset-cache
npx react-native run-android
```

## Structure

- `src/config/apiConfig.js`
- `src/api/apiClient.js`
- `src/api/ownerApi.js`
- `src/navigation/OwnerNavigator.js`
- `src/screens/*`
- `src/components/*`
- `src/context/*`

## Notes

- The app uses the same owner endpoints as the existing website.
- Test credentials are not stored in source code.
- Socket.io reconnects after login and refreshes order-related screens when events arrive.
- This app does not use Expo or Expo Go.

## Owner New Order Notifications

- Install dependencies with `npm install`. The app now uses `@react-native-firebase/app`, `@react-native-firebase/messaging`, `@notifee/react-native`, and `react-native-sound`.
- Create a Firebase project for the Android package `com.daawatowner`, then download `google-services.json` and place it at `android/app/google-services.json`.
- The owner order notification channel currently uses the default Android notification sound so Firebase delivery can be verified first without any custom ringtone setup.
- Backend Firebase Admin credentials must be provided through Render env vars. Supported options are:
  - `FIREBASE_SERVICE_ACCOUNT`
  - `FIREBASE_SERVICE_ACCOUNT_BASE64`
  - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`
- On Android 13 and above, the app requests notification permission after owner login. If notifications are denied, the app shows: `Please enable notifications to receive new order alerts.`
- The owner app keeps the existing 15-second polling fallback while open, so missed socket events can still surface the in-app alert modal.
- Android can still block delivery if the app is force-stopped from Settings, notifications are disabled, or aggressive battery restrictions stop background work. That limitation is platform-level and applies even with FCM + Notifee.
- Notification actions attempt to accept or reject pending orders directly from the notification. If the OS blocks background execution, tapping the notification will still bring the owner into the Orders screen to finish handling it.

## Android CMake/Ninja Troubleshooting

If the Android CMake or `ninja` build crashes, run:

```powershell
taskkill /F /IM node.exe
taskkill /F /IM java.exe
Remove-Item -Recurse -Force android/app/.cxx
Remove-Item -Recurse -Force android/app/build
Remove-Item -Recurse -Force android/.gradle
cd android
gradlew --stop
gradlew clean
```

Then run the app again:

```bash
npx react-native run-android
```
