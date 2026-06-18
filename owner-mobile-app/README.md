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
