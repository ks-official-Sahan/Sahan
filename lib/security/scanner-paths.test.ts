import assert from "node:assert/strict";
import { test } from "node:test";

import { isScannerPath } from "./scanner-paths";

test("scanner probes are recognised", () => {
  for (const path of [
    "/.env",
    "/.env.local",
    "/app/.env",
    "/.git/config",
    "/site/.git/HEAD",
    "/wp-admin",
    "/wp-admin/install.php",
    "/wp-login.php",
    "/blog/wp-content/uploads/x.png",
    "/xmlrpc.php",
    "/index.php",
    "/phpmyadmin/",
    "/cgi-bin/test",
    "/actuator/health",
    "/%2eenv",
    "/backup.sql",
    "/.aws/credentials",
  ]) {
    assert.equal(isScannerPath(path), true, path);
  }
});

test("real routes and ordinary files are left alone", () => {
  for (const path of [
    "/",
    "/about",
    "/works",
    "/updates",
    "/updates/a-post",
    "/contact",
    "/admin",
    "/admin/login",
    "/api/auth/session",
    "/robots.txt",
    "/sitemap.xml",
    "/manifest.webmanifest",
    "/.well-known/security.txt",
    "/opengraph-image",
    "/media/covers/a.jpg",
    "/environment",
    "/phpstorm-tips",
  ]) {
    assert.equal(isScannerPath(path), false, path);
  }
});

test("an undecodable path does not throw", () => {
  assert.equal(isScannerPath("/%E0%A4%A"), false);
});
