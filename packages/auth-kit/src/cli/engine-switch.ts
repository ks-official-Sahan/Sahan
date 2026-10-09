// Pure planning for `auth-kit engine <name>`: which source files import an
// engine subpath, and what they become. The CLI reads and writes the files.

export const ENGINES = ["next-auth", "better-auth"] as const;
export type EngineName = (typeof ENGINES)[number];

const SPECIFIER = /(["'])@sahan-sac\/auth-kit\/engines\/(next-auth|better-auth)(\/cookie)?\1/g;

export interface SourceFile {
  path: string;
  text: string;
}

export interface FileChange {
  path: string;
  text: string;
  /** Each rewritten specifier, "from -> to". */
  edits: string[];
}

/** Engines the given sources import, in first-seen order. */
export function enginesIn(files: readonly SourceFile[]): EngineName[] {
  const found = new Set<EngineName>();
  for (const file of files) for (const match of file.text.matchAll(SPECIFIER)) found.add(match[2] as EngineName);
  return [...found];
}

/** The files to rewrite so every engine import points at `to`. Files already on `to` are left out. */
export function planEngineSwitch(files: readonly SourceFile[], to: EngineName): FileChange[] {
  const changes: FileChange[] = [];
  for (const file of files) {
    const edits: string[] = [];
    const text = file.text.replace(SPECIFIER, (whole, quote: string, engine: string, cookie = "") => {
      if (engine === to) return whole;
      edits.push(`@sahan-sac/auth-kit/engines/${engine}${cookie} -> @sahan-sac/auth-kit/engines/${to}${cookie}`);
      return `${quote}@sahan-sac/auth-kit/engines/${to}${cookie}${quote}`;
    });
    if (edits.length) changes.push({ path: file.path, text, edits });
  }
  return changes;
}

/** The package-manager command that swaps the engine dependency. Printed, never run. */
export function swapCommand(manager: "pnpm" | "npm" | "yarn" | "bun", from: EngineName, to: EngineName): string {
  const remove = { pnpm: "pnpm remove", npm: "npm uninstall", yarn: "yarn remove", bun: "bun remove" }[manager];
  const add = { pnpm: "pnpm add", npm: "npm install", yarn: "yarn add", bun: "bun add" }[manager];
  const pkg = (engine: EngineName) => (engine === "next-auth" ? "next-auth@beta" : "better-auth");
  return `${remove} ${from} && ${add} ${pkg(to)}`;
}
