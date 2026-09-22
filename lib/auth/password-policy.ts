// Policy for every new password (docs/plan/admin-cms-adr.md, section 6.5):
// 12 to 128 characters, at least three of lower, upper, digit and symbol, not the
// email or its local part, and not a common password. The seeded owner password
// is exempt: it is temporary and forces a change at first sign-in.

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

// Short list of passwords that keep topping breach statistics. It is a floor,
// not a substitute for a breach-corpus check.
const COMMON = new Set([
  "password", "password1", "password12", "password123", "passw0rd", "p@ssw0rd", "p@ssword",
  "admin", "admin123", "administrator", "welcome", "welcome1", "welcome123", "letmein",
  "qwerty", "qwerty123", "qwertyuiop", "asdfghjkl", "zxcvbnm", "1q2w3e4r", "1qaz2wsx",
  "iloveyou", "monkey", "dragon", "football", "baseball", "superman", "batman", "sunshine",
  "princess", "master", "shadow", "trustno1", "abc123", "abcd1234", "changeme", "changeit",
  "default", "secret", "test1234", "testtest", "sahan", "sahansachintha", "portfolio",
  "internet", "computer", "whatever", "freedom", "starwars", "login", "hello123",
  "123456789", "1234567890", "12345678", "123123123", "111111111111", "000000000000",
]);

export interface PasswordContext {
  email?: string | null;
  name?: string | null;
}

export interface PasswordCheck {
  ok: boolean;
  /** Plain sentences, safe to show to the user. */
  problems: string[];
}

function classes(value: string): number {
  return [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(value)).length;
}

function letters(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

export function checkPassword(password: string, context: PasswordContext = {}): PasswordCheck {
  const problems: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    problems.push(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    problems.push(`Use at most ${PASSWORD_MAX_LENGTH} characters.`);
  }
  if (classes(password) < 3) {
    problems.push("Mix at least three of: lower case, upper case, digits and symbols.");
  }

  const lowered = password.toLowerCase();
  const email = context.email?.trim().toLowerCase();
  if (email) {
    const local = email.split("@")[0];
    if (lowered === email || (local.length >= 4 && lowered === local)) {
      problems.push("Do not use your email address as your password.");
    }
  }

  if (COMMON.has(lowered) || (letters(password).length >= 5 && COMMON.has(letters(password)))) {
    problems.push("That password is too common. Pick something less guessable.");
  }

  return { ok: problems.length === 0, problems };
}
