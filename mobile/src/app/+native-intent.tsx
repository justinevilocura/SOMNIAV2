export function redirectSystemPath({ path }: { path: string }) {
  try {
    if (path.includes('oauth2redirect') || path.includes('oauthredirect')) {
      // Intercept the OAuth deep link and return to the login screen
      // where Google.useAuthRequest processes the response tokens
      return '/(auth)/login';
    }
    return path;
  } catch {
    return path;
  }
}
