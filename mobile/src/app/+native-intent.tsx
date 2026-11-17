import AsyncStorage from '@react-native-async-storage/async-storage';

export async function redirectSystemPath({ path }: { path: string }) {
  try {
    if (path.includes('oauth2redirect') || path.includes('oauthredirect')) {
      // Return to whichever screen initiated the Google authentication
      const origin = await AsyncStorage.getItem('googleAuthOrigin');
      return origin || '/(auth)/login';
    }
    return path;
  } catch {
    return path;
  }
}
