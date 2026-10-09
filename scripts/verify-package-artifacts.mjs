import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temp = await mkdtemp(path.join(root, ".tmp-package-artifacts-"));
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const packDir = path.join(temp, "packs");
const consumerDir = path.join(temp, "consumer");
const consumerDependencies = {};
const unpackedPackages = new Map();

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} exited with ${result.status}`);
  return result;
}

function collectExportTargets(value, result = []) {
  if (typeof value === "string") {
    if (value.startsWith("./")) result.push(value.slice(2));
  } else if (value && typeof value === "object") {
    for (const child of Object.values(value)) collectExportTargets(child, result);
  }
  return result;
}

async function packageDirectories() {
  const entries = await readdir(path.join(root, "packages"), { withFileTypes: true });
  const manifests = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
    const dir = path.join(root, "packages", entry.name);
    const manifest = JSON.parse(await readFile(path.join(dir, "package.json"), "utf8"));
    return manifest.publishConfig?.exports ? { dir, manifest } : null;
  }));
  return manifests.filter(Boolean);
}

const MODULE_SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)["']([^"']+)["']/g;
const REACT_SPECIFIER = /^(?:react|react-dom)(?:\/|$)/;

async function checkPublishedGraph(packagePath, entry, visited = new Set()) {
  const absolute = path.resolve(packagePath, entry);
  if (visited.has(absolute)) return;
  visited.add(absolute);
  const source = await readFile(absolute, "utf8");
  // Every module reference in emitted JS: `import ... from`, `export ... from`,
  // bare `import "x"`, dynamic `import("x")` and `require("x")`. A false match
  // inside a string or comment only fails the check, never hides a leak.
  for (const [, specifier] of source.matchAll(MODULE_SPECIFIER)) {
    if (REACT_SPECIFIER.test(specifier)) {
      throw new Error(`React (${specifier}) leaked into the framework-neutral auth-kit graph at ${path.relative(packagePath, absolute)}`);
    }
    if (specifier.startsWith(".")) await checkPublishedGraph(packagePath, path.resolve(path.dirname(absolute), specifier), visited);
  }
}

try {
  await mkdir(packDir, { recursive: true });
  await mkdir(consumerDir, { recursive: true });
  const packages = await packageDirectories();

  for (const { dir, manifest: sourceManifest } of packages) {
    const packagePackDir = path.join(packDir, sourceManifest.name.split("/").at(-1));
    await mkdir(packagePackDir, { recursive: true });
    run(pnpm, ["pack", "--pack-destination", packagePackDir], { cwd: dir, shell: process.platform === "win32" });
    const tarballs = (await readdir(packagePackDir)).filter((file) => file.endsWith(".tgz"));
    const archive = path.join(packagePackDir, tarballs[0] ?? "missing.tgz");
    if (!tarballs.length) throw new Error(`pnpm pack produced no tarball for ${sourceManifest.name}`);

    const unpackDir = path.join(temp, `unpack-${sourceManifest.name.split("/").at(-1)}`);
    await mkdir(unpackDir, { recursive: true });
    // Relative to `temp`: GNU tar (Git for Windows) reads "G:\..." as host:path.
    run("tar", ["-xzf", path.relative(temp, archive), "-C", path.relative(temp, unpackDir)], { cwd: temp });
    const packagePath = path.join(unpackDir, "package");
    const packedManifest = JSON.parse(await readFile(path.join(packagePath, "package.json"), "utf8"));
    const archiveFiles = new Set(run("tar", ["-tzf", path.relative(temp, archive)], { cwd: temp, stdio: "pipe" }).stdout.trim().split(/\r?\n/));
    const targets = [
      ...collectExportTargets(packedManifest.exports),
      packedManifest.main,
      packedManifest.types,
      ...Object.values(packedManifest.bin ?? {}),
    ].filter((target) => typeof target === "string" && target.startsWith("./"));
    for (const target of new Set(targets)) {
      if (!archiveFiles.has(`package/${target.slice(2)}`)) {
        throw new Error(`${sourceManifest.name} export target ${target} is missing from its npm tarball`);
      }
    }
    const dependencies = Object.values({
      ...packedManifest.dependencies,
      ...packedManifest.optionalDependencies,
    });
    if (dependencies.some((version) => typeof version === "string" && version.startsWith("workspace:"))) {
      throw new Error(`${sourceManifest.name} tarball contains an unresolved workspace dependency`);
    }

    const localTarball = path.relative(consumerDir, archive).replaceAll("\\", "/");
    consumerDependencies[sourceManifest.name] = `file:${localTarball}`;
    unpackedPackages.set(sourceManifest.name, packagePath);
    console.log(`Verified packed exports: ${sourceManifest.name}@${packedManifest.version}`);
  }

  await writeFile(
    path.join(consumerDir, "package.json"),
    JSON.stringify(
      {
        name: "sahan-package-consumer-fixture",
        private: true,
        type: "module",
        dependencies: consumerDependencies,
        devDependencies: {
          "@auth/core": "0.41.3",
          "@types/node": "^22.0.0",
          "better-auth": "^1.7.6",
          "drizzle-orm": "^0.45.3",
          hono: "^4.13.10",
          next: "^16.3.5",
          "next-auth": "5.0.0-beta.32",
          // Auth.js supports Nodemailer 7/8; email-kit must be installable
          // beside it while retaining support for the app's Nodemailer 10.
          nodemailer: "^8.0.5",
          pg: "^8.23.0",
          react: "^19.0.0",
          resend: "^6.28.1",
          typescript: "^5.6.3",
        },
      },
      null,
      2
    )
  );
  // Reuse the local store when possible, but fetch dependencies missing from
  // the cache so this remains a real packed-consumer check on fresh machines.
  run(pnpm, ["install", "--ignore-workspace", "--prefer-offline", "--ignore-scripts", "--strict-peer-dependencies"], {
    cwd: consumerDir,
    shell: process.platform === "win32",
  });

  await checkPublishedGraph(unpackedPackages.get("@sahan-sac/auth-kit"), "dist/index.js");
  await checkPublishedGraph(unpackedPackages.get("@sahan-sac/auth-kit"), "dist/rbac/index.js");

  const serverSmoke = [
    "@sahan-sac/ai-core",
    "@sahan-sac/auth-kit",
    "@sahan-sac/auth-kit/rbac",
    "@sahan-sac/auth-kit/rbac/react",
    "@sahan-sac/auth-kit/next-auth-types",
    "@sahan-sac/blog-kit",
    "@sahan-sac/chat-kit",
    "@sahan-sac/email-kit",
    "@sahan-sac/media-kit",
  ];
  await writeFile(
    path.join(temp, "consumer", "server-smoke.mjs"),
    `for (const specifier of ${JSON.stringify(serverSmoke)}) { await import(specifier); }\n`
  );
  run(process.execPath, ["--conditions=react-server", path.join(temp, "consumer", "server-smoke.mjs")]);
  await writeFile(
    path.join(temp, "consumer", "client-smoke.mjs"),
    `await import("@sahan-sac/auth-kit-client");\n`
  );
  // Client integrations use React's default export conditions. The
  // react-server condition intentionally exposes React's server-only build,
  // which cannot satisfy client hook imports in a plain Node process.
  run(process.execPath, [path.join(temp, "consumer", "client-smoke.mjs")]);

  await writeFile(
    path.join(temp, "consumer", "auth-types.ts"),
    `import "@sahan-sac/auth-kit/next-auth-types";\nimport type { Session, User } from "next-auth";\nimport type { JWT } from "@auth/core/jwt";\ndeclare const session: Session;\ndeclare const user: User;\ndeclare const token: JWT;\nconst sessionId: string = session.sid;\nconst role: string | undefined = user.role;\nconst tokenSessionId: string | undefined = token.sid;\nvoid [sessionId, role, tokenSessionId];\n`
  );
  run(pnpm, ["exec", "tsc", "--noEmit", "--strict", "--skipLibCheck", "--target", "ES2022", "--module", "ESNext", "--moduleResolution", "Bundler", path.join(temp, "consumer", "auth-types.ts")], {
    cwd: consumerDir,
    shell: process.platform === "win32",
  });
  console.log(`Verified external ESM imports and Auth.js declarations for ${packages.length} packages.`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
