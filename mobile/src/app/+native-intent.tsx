export function redirectSystemPath({ path }: { path: string }) {
  try {
    if (path.includes('oauth2redirect') || path.includes('oauthredirect')) {
      // Direct deep link to /oauth2redirect so it can process tokens and authenticate
      return '/oauth2redirect';
    }
    return path;
  } catch {
    return path;
  }
}
