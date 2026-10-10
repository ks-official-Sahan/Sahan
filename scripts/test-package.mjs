// Runs a package's src/**/*.test.ts suite with `node --test`.
//
// Node 20's test runner does not expand glob arguments (that arrived in Node
// 21), and the packages support Node >=20, so the file list is collected here
// instead. Arguments are passed to node before `--test`, e.g.
//   node ../../scripts/test-package.mjs --conditions=react-server
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

const files = readdirSync("src", { recursive: true })
  .map(String)
  .filter((file) => file.endsWith(".test.ts"))
  .sort()
  .map((file) => path.join("src", file));

if (files.length === 0) {
  console.error(`No src/**/*.test.ts files in ${process.cwd()}`);
  process.exit(1);
}

const result = spawnSync(process.execPath, [...process.argv.slice(2), "--import", "tsx", "--test", ...files], {
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
