"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { auditSafe } from "@/lib/admin/audit";
import { hasValidUnlock } from "@/lib/admin/unlock-request";
import { signIn, signOut } from "@/lib/auth/config";
import { getOptionalUser } from "@/lib/auth/dal";
import { safeCallbackUrl } from "@/lib/auth/safe-callback-url";
import { revokeSession } from "@/lib/auth/session-store";

// Sign-in and sign-out as Server Functions. They stay POST requests to the
// admin route, so the proxy origin check and the Next origin check both apply
// (docs/plan/admin-cms-adr.md, sections 4.5 and 6.1).

export interface SignInState {
  error: string | null;
}

const MESSAGES: Record<string, string> = {
  limited: "Too many attempts. Wait a while and try again.",
  mfa_required: "Sign-in with a second factor is not available yet. Ask the site owner.",
};
const GENERIC = "The email or password is not correct.";

function messageFor(code: string | null | undefined): string {
  return (code && MESSAGES[code]) || GENERIC;
}

function codeOf(error: unknown): string | null {
  if (error instanceof AuthError) {
    const code = (error as AuthError & { code?: string }).code;
    return typeof code === "string" ? code : "invalid";
  }
  return null;
}

export async function startSignIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const target = safeCallbackUrl(formData.get("callbackUrl"));

  // Same answer as a wrong password, so this cannot be used to probe the unlock.
  if (!(await hasValidUnlock())) return { error: GENERIC };

  try {
    const result = await signIn("credentials", { email, password, redirect: false });
    // Depending on the version, a refused sign-in throws or comes back as a URL.
    if (typeof result === "string" && result.includes("error=")) {
      return { error: messageFor(new URL(result, "http://local").searchParams.get("code")) };
    }
  } catch (error) {
    const code = codeOf(error);
    if (code === null) throw error;
    return { error: messageFor(code) };
  }

  redirect(target);
}

export async function signOutAction(): Promise<void> {
  const user = await getOptionalUser();
  if (user) {
    await revokeSession(user.sid, { userId: user.id, reason: "sign_out" });
    await auditSafe({
      action: "auth.logout",
      actor: { id: user.id, email: user.email },
      entityType: "UserSession",
      entityId: user.sid,
    });
  }
  await signOut({ redirectTo: "/" });
}
