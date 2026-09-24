// Generic, app-agnostic constants shared by the package's own modules. Names,
// paths, cookie names and key prefixes are app policy and belong in the app's
// `defineAuthKit` config (see kit.ts), not here. This file only keeps values
// that are safe defaults for any app.

/** JWT lifetime. A DB-backed session row should expire at the same moment and is the authority. */
export const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

/**
 * `__Host-`-prefixed cookie names are the strongest cookie the platform
 * offers (Secure, Path=/, no Domain, cannot be set over plain HTTP or from a
 * subdomain), but they require Path=/ exactly, so they only make sense in
 * production over HTTPS. In development, over plain HTTP, the browser drops a
 * `__Host-` cookie outright, so the plain name is used instead. Renaming a
 * cookie signs out every existing session the first time this ships to
 * production, since the browser is holding the old, unprefixed name.
 */
export function resolveCookieName(base: string, production: boolean): string {
  return production ? `__Host-${base}` : base;
}
