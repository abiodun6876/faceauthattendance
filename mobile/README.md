# FaceAuth Attendance Mobile App

This is a React Native app built with Expo that connects to the same Supabase backend as the web dashboard.

## Prerequisites

- [Expo Go](https://expo.dev/client) app installed on your iOS or Android device.
- Node.js installed on your computer.

## Setup

1. Navigate to the mobile directory:
   ```bash
   cd mobile
   ```

2. Install dependencies (if not already done):
   ```bash
   npm install
   ```

## Running the App

1. Start the Expo development server:
   ```bash
   npx expo start
   ```

2. Scan the QR code displayed in the terminal using the Expo Go app on your phone.
   - **Android**: Use the Expo Go app to scan the QR code.
   - **iOS**: Use the default Camera app to scan the QR code.

## Architecture

- **Supabase**: Uses the same Supabase project as the web app. Keys are configured in `lib/supabase.ts`.
- **Navigation**: Uses Expo Router (file-based routing in `app/`).
- **State Management**: Local state + Supabase real-time (planned).
- **Offline Sync**: Uses `AsyncStorage` to queue attendance records when offline.

## Key Screens

- `app/index.tsx`: Splash screen & Device Registration Check.
- `app/device-setup.tsx`: Link the device to an organization using Device Code & Pairing Code.
- `app/branch-selection.tsx`: Choose the active branch for this kiosk.
- `app/attendance.tsx`: Main attendance taking screen with facial recognition (camera only for now).

## Troubleshooting

- If you see `Unable to resolve module`, try:
  ```bash
  npx expo start -c
  ```
  to clear the Metro bundler cache.
