# @sahan-sac/auth-kit-client

React web and React Native (Expo) client for
[`@sahan-sac/auth-kit`](../auth-kit)'s Better Auth engine:

- `createAuthKitClient`: a Better Auth React client that knows auth-kit's user
  fields (`role`, `mustChangePassword`) and its sign-in
  (`authClient.authKit.signIn`, `authClient.authKit.signOut`);
- `usePermission`: show or hide screens by role or permission;
- `permissionCheck`: auth-kit's RBAC rules on the client (`can` from
  `@sahan-sac/auth-kit/rbac/rules`);
- `createApiFetch`: calls your own API routes with the session, and refuses
  any other host so the session never leaks;
- `parseAuthLink`: recognises auth-kit's short links (`/a/`, `/e/`, `/s/`)
  arriving as universal links, so an app can hand them to the browser.

The server is the authority. Everything here only decides what the app shows.

It needs a server on the Better Auth engine with its routes mounted (below).
A Next.js app that signs in through server actions needs no client package,
and next-auth has no browser or native client.

## Install

```bash
# React web (Vite, Next.js client components, ...)
npm install @sahan-sac/auth-kit-client better-auth

# Expo
npx expo install @sahan-sac/auth-kit-client better-auth @better-auth/expo expo-secure-store expo-linking expo-constants expo-network expo-web-browser
```

## Client

```ts
// React web: the browser keeps the session cookie.
import { createApiFetch, createAuthKitClient } from "@sahan-sac/auth-kit-client";

export const authClient = createAuthKitClient({ baseURL: import.meta.env.VITE_API_URL, plugins: [] });
export const apiFetch = createApiFetch({ baseURL: import.meta.env.VITE_API_URL });
```

```ts
// Expo: the session cookie lives in SecureStore.
import { expoClient } from "@better-auth/expo/client";
import { createApiFetch, createAuthKitClient } from "@sahan-sac/auth-kit-client";
import * as SecureStore from "expo-secure-store";

const API_URL = process.env.EXPO_PUBLIC_API_URL!;

export const authClient = createAuthKitClient({
  baseURL: API_URL,
  plugins: [expoClient({ scheme: "myapp", storagePrefix: "myapp", storage: SecureStore })],
});

export const apiFetch = createApiFetch({
  baseURL: API_URL,
  getCookie: () => authClient.getCookie(),
  appOrigin: "myapp://",
});
```

```tsx
// Sign-in: auth-kit's rules apply (lockout, rate limits, emailed codes).
const result = await authClient.authKit.signIn({ email, password });
if (!result.ok && result.code === "mfa_required") showCodeStep(); // then signIn({ challengeId })

// Sign-out also revokes the session row on the server.
await authClient.authKit.signOut();

// A screen
const { allowed, isPending } = usePermission(authClient, (user) => user.role === "DEVELOPER");
```

## Links from emails

Invite, reset, email-change and sign-in emails carry short links on your site
(`/a/<token>`, `/e/<token>`, `/s/<code>`). If the site's domain is set up
for universal links, they open the app. Hand them to the browser, where the
server checks them:

```ts
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { parseAuthLink } from "@sahan-sac/auth-kit-client";

Linking.addEventListener("url", ({ url }) => {
  if (parseAuthLink(url, process.env.EXPO_PUBLIC_SITE_URL!)) void WebBrowser.openBrowserAsync(url);
});
```

Only links on `siteUrl`'s exact origin match. Nothing is verified on the
device.

## Server

Better Auth on auth-kit's tables, mounted on a Hono API (Node, Bun, Workers):

```ts
import { expo } from "@better-auth/expo"; // Expo apps only
import { createAuthorize } from "@sahan-sac/auth-kit";
import { createAuthKitBetterAuth } from "@sahan-sac/auth-kit/better-auth";
import { betterAuthRoute, originGuard } from "@sahan-sac/auth-kit/hono";

const auth = await createAuthKitBetterAuth({
  database: { pool }, // or { prisma } / { drizzle: db }
  authorize: createAuthorize(signInDeps),
  secret: process.env.AUTH_SECRET!,
  origins: ["https://app.example.com", "myapp://"],
  revokeSession: (sessionId, userId) => signInDeps.sessionStore.revokeSession(sessionId, { userId, reason: "sign_out" }),
  plugins: [expo()],
});

app.use("/api/*", originGuard({ siteUrl: process.env.SITE_URL, nativeOrigins: ["myapp://"] }));
app.on(["GET", "POST"], "/api/auth/*", betterAuthRoute(auth));
```

Native apps send no `Origin`. The Expo client sends `expo-origin` instead.
A browser page cannot set that header on a cross-site request without a CORS
preflight, so `originGuard` accepts an exact match from `nativeOrigins`. A
request that also carries a browser `Origin` is still judged by that `Origin`.

## License

Apache-2.0
