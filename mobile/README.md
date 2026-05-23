# SOMNiA Mobile App

This is a React Native mobile application for SOMNiA.

## Prerequisites

- Node.js >= 14
- JDK 11
- Android Studio
- Android SDK
- React Native CLI

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start Metro bundler:
```bash
npm start
```

3. Run on Android:
```bash
npm run android
```

## Building for Production

To create a production build for Android:

```bash
npm run build:android
```

The APK will be generated in `android/app/build/outputs/apk/release/`.

## Development

- The app uses TypeScript for type safety
- Follow the ESLint configuration for code style
- Use the provided components in the `components` directory
- Styles are located in the `assets/styles` directory

## Project Structure

- `/android` - Android native code
- `/app` - Main application code
- `/components` - Reusable React components
- `/assets` - Static assets and styles
- `/utils` - Utility functions and helpers
