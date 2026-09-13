/** Vérifie l'origine et le chemin avant de joindre le JWT à une requête. */
export function isApiUrl(url: string, apiBaseUrl: string, appOrigin: string): boolean {
  try {
    const target = new URL(url, appOrigin);
    const base = new URL(apiBaseUrl, appOrigin);
    const prefix = base.pathname.replace(/\/$/, '');
    return (
      target.origin === base.origin &&
      (target.pathname === prefix || target.pathname.startsWith(prefix + '/'))
    );
  } catch {
    return false;
  }
}
