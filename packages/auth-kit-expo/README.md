# @sahan-sac/auth-kit-expo

React Native (Expo) client for [`@sahan-sac/auth-kit`](../auth-kit)'s Better
Auth engine:

- `createAuthKitClient`: a Better Auth React client that knows auth-kit's user
  fields (`role`, `mustChangePassword`);
- `usePermission`: show or hide screens by role or permission;
- `permissionCheck`: auth-kit's RBAC rules on the device (`can` from
  `@sahan-sac/auth-kit/rbac/rules`);
- `createApiFetch`: calls your own API routes with the stored session and the
  app origin, and refuses any other host so the session never leaks;
- `parseAuthLink`: recognises auth-kit's short links (`/a/`, `/e/`, `/s/`)
  arriving as universal links, so the app can hand them to the browser.

The server is the authority. Everything here only decides what the app shows.

It works with the Better Auth engine only. next-auth has no native client.

## Install

```bash
npx expo install @sahan-sac/auth-kit-expo better-auth @better-auth/expo expo-secure-store expo-linking expo-constants expo-network expo-web-browser
```

## Client

```ts
// lib/auth.ts
import { expoClient } from "@better-auth/expo/client";
import { createApiFetch, createAuthKitClient } from "@sahan-sac/auth-kit-expo";
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
// A screen
const { allowed, isPending } = usePermission(authClient, (user) => user.role === "DEVELOPER");
if (isPending) return <ActivityIndicator />;
if (!allowed) return <Redirect href="/" />;
```

## Links from emails

Invite, reset, email-change and sign-in emails carry short links on your site
(`/a/<token>`, `/e/<token>`, `/s/<code>`). If the site's domain is set up
for universal links, they open the app. Hand them to the browser, where the
server checks them:

```ts
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { parseAuthLink } from "@sahan-sac/auth-kit-expo";

Linking.addEventListener("url", ({ url }) => {
  if (parseAuthLink(url, process.env.EXPO_PUBLIC_SITE_URL!)) void WebBrowser.openBrowserAsync(url);
});
```

Only links on `siteUrl`'s exact origin match. Nothing is verified on the
device.

## Server

Add Better Auth's Expo plugin, trust the app scheme, and let native requests
through auth-kit's origin check:

```ts
import { expo } from "@better-auth/expo";
import { authKit, authKitEmailPassword } from "@sahan-sac/auth-kit/better-auth";
import { originGuard } from "@sahan-sac/auth-kit/hono";

export const auth = betterAuth({
  // ...database, secret, baseURL
  trustedOrigins: ["myapp://"],
  emailAndPassword: authKitEmailPassword(),
  plugins: [expo(), authKit({ /* limit, audit, canSignIn */ })],
});

app.use("/api/*", originGuard({ siteUrl: process.env.SITE_URL, nativeOrigins: ["myapp://"] }));
```

Native apps send no `Origin`. The Expo client sends `expo-origin` instead.
A browser page cannot set that header on a cross-site request without a CORS
preflight, so `originGuard` accepts an exact match from `nativeOrigins`. A
request that also carries a browser `Origin` is still judged by that `Origin`.

## License

Apache-2.0
