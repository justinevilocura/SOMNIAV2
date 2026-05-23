import { Platform } from 'react-native';

export const loadFonts = async () => {
  try {
    // In React Native, fonts are loaded automatically when placed in the correct directory
    // For Android: android/app/src/main/assets/fonts/
    // For iOS: ios/Fonts/
    return true;
  } catch (error) {
    console.error('Error loading fonts:', error);
    return false;
  }
}; 