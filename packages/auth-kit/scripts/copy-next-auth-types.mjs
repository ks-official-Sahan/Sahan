import { copyFile } from "node:fs/promises";

const packageRoot = new URL("../", import.meta.url);
await copyFile(new URL("src/next-auth.d.ts", packageRoot), new URL("dist/next-auth-types.d.ts", packageRoot));
