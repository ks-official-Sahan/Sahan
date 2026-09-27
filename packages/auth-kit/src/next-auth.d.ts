import type { DefaultSession } from "next-auth";

import type { RoleName } from "./adapter";

// The claims of docs/plan/admin-cms-adr.md, section 6.3.

declare module "next-auth" {
  interface User {
    sid?: string;
    role?: RoleName;
    pwf?: string;
    mfa?: boolean;
  }

  interface Session {
    sid: string;
    role: RoleName;
    pwf: string;
    mfa: boolean;
    user: { id: string } & DefaultSession["user"];
  }
}

// `next-auth/jwt`'s JWT interface is a namespace re-export of `@auth/core/jwt`'s
// (`export * from "@auth/core/jwt"`); TS declaration merging only applies at the
// module that originally declares the interface, so the augmentation targets
// `@auth/core/jwt` directly.
declare module "@auth/core/jwt" {
  interface JWT {
    sid?: string;
    role?: RoleName;
    pwf?: string;
    mfa?: boolean;
  }
}
