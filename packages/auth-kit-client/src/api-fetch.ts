export interface ApiFetchOptions {
  /** The API's URL. Requests may only go to this origin, so the session never leaks elsewhere. */
  baseURL: string;
  /**
   * Native apps: the stored session cookie, e.g. `() => authClient.getCookie()`
   * with Better Auth's Expo plugin. Leave out in a browser, which sends the
   * cookie itself (`credentials: "include"`).
   */
  getCookie?: () => string | null | undefined;
  /** The app's scheme origin, like `"myapp://"`, sent as `expo-origin` for the API's origin check. */
  appOrigin?: string;
  fetch?: typeof fetch;
}

/**
 * `fetch` for your own API routes. In a native app it adds the stored session
 * cookie and the app origin (pair with `originGuard({ nativeOrigins })` from
 * "@sahan-sac/auth-kit/hono"); in a browser it lets the browser send the
 * cookie. Either way it only calls `baseURL`'s origin.
 */
export function createApiFetch(options: ApiFetchOptions) {
  const base = new URL(options.baseURL);
  const doFetch = options.fetch ?? fetch;
  return (path: string, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(path, base);
    if (url.origin !== base.origin) {
      return Promise.reject(new Error(`createApiFetch only calls ${base.origin}; got ${url.origin}.`));
    }
    const headers = new Headers(init.headers);
    if (!options.getCookie) return doFetch(url, { ...init, headers, credentials: "include" });
    const cookie = options.getCookie();
    if (cookie) headers.set("cookie", cookie);
    if (options.appOrigin) headers.set("expo-origin", options.appOrigin);
    return doFetch(url, { ...init, headers, credentials: "omit" });
  };
}
