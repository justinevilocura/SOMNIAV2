export function redirectSystemPath({ path }: { path: string }) {
  try {
    if (path.includes('oauth2redirect') || path.includes('oauthredirect')) {
      // Returning an empty string prevents Expo Router from navigating to a new route.
      // This keeps the login/register screen mounted so Google.useAuthRequest can
      // complete the token exchange and log the user in!
      return '';
    }
    return path;
  } catch {
    return path;
  }
}
