import { describe, it, mock } from "node:test";
import { strict as assert } from "node:assert";

import { CloudinaryClient, type FetchFn } from "./cloudinary";

const CONFIG = { cloudName: "demo", apiKey: "key123", apiSecret: "secret456" };

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe("CloudinaryClient", () => {
  it("every request carries an AbortSignal", async () => {
    const calls: RequestInit[] = [];
    const fetchFn: FetchFn = (async (_url: string, init?: RequestInit) => {
      calls.push(init ?? {});
      return jsonResponse({ deleted: { abc: "deleted" } });
    }) as FetchFn;

    const client = new CloudinaryClient({ ...CONFIG, fetch: fetchFn });
    await client.getAsset("abc");
    await client.deleteAsset("abc");
    await client.uploadBase64({ dataUri: "data:image/png;base64,AAAA", folder: "sahan" });

    assert.equal(calls.length, 3);
    for (const call of calls) assert(call.signal instanceof AbortSignal, "request missing AbortSignal");
  });

  it("deleteAsset returns true for deleted and not_found, false on non-OK", async () => {
    const deleted = new CloudinaryClient({
      ...CONFIG,
      fetch: (async () => jsonResponse({ deleted: { abc: "deleted" } })) as FetchFn,
    });
    assert.equal(await deleted.deleteAsset("abc"), true);

    const notFound = new CloudinaryClient({
      ...CONFIG,
      fetch: (async () => jsonResponse({ deleted: { abc: "not_found" } })) as FetchFn,
    });
    assert.equal(await notFound.deleteAsset("abc"), true);

    const onWarn = mock.fn();
    const failed = new CloudinaryClient({
      ...CONFIG,
      fetch: (async () => jsonResponse({}, false, 500)) as FetchFn,
      onWarn,
    });
    assert.equal(await failed.deleteAsset("abc"), false);
    assert.equal(onWarn.mock.calls.length, 1);
  });

  it("uploadBase64 returns null and calls onWarn on non-OK", async () => {
    const onWarn = mock.fn();
    const client = new CloudinaryClient({
      ...CONFIG,
      fetch: (async () => jsonResponse({ error: { message: "Invalid Signature" } }, false, 401)) as FetchFn,
      onWarn,
    });

    const result = await client.uploadBase64({ dataUri: "data:image/png;base64,AAAA", folder: "sahan" });
    assert.equal(result, null);
    assert.equal(onWarn.mock.calls.length, 1);
    assert.equal(onWarn.mock.calls[0].arguments[0], "cloudinary upload failed");
  });

  it("onWarn defaults to a no-op when not provided", async () => {
    const client = new CloudinaryClient({
      ...CONFIG,
      fetch: (async () => jsonResponse({}, false, 500)) as FetchFn,
    });
    // No onWarn passed: must not throw.
    assert.equal(await client.deleteAsset("abc"), false);
  });

  it("constructor with missing credentials throws on use", async () => {
    const client = new CloudinaryClient({ cloudName: "", apiKey: "", apiSecret: "" });
    await assert.rejects(() => client.getAsset("abc"), /not configured/);
    await assert.rejects(() => client.deleteAsset("abc"), /not configured/);
    await assert.rejects(() => client.uploadBase64({ dataUri: "data:image/png;base64,AAAA", folder: "sahan" }), /not configured/);
  });
});
