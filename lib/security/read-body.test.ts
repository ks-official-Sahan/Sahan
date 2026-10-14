import assert from "node:assert/strict";
import { test } from "node:test";

import { UNLOCK_FORM_MAX_BYTES } from "../admin/unlock-form";
import { readBodyText } from "./read-body";

const post = (body: BodyInit | null, headers: Record<string, string> = {}) => new Request("https://example.com/api", { method: "POST", body, headers, duplex: "half" } as RequestInit);

function stream(parts: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let pulled = 0;
  return new ReadableStream({
    pull(controller) {
      if (pulled < parts.length) controller.enqueue(encoder.encode(parts[pulled++]));
      else controller.close();
    },
  });
}

test("a body within the limit reads back as text, multi-byte characters included", async () => {
  assert.equal(await readBodyText(post('{"q":"héllo"}'), 64), '{"q":"héllo"}');
  assert.equal(await readBodyText(post(null), 64), "");
});

test("a declared Content-Length over the limit is refused without reading", async () => {
  assert.equal(await readBodyText(post("{}", { "content-length": "999999" }), 64), null);
});

test("a streamed body stops at the first chunk past the limit", async () => {
  let pulled = 0;
  const parts = ["a".repeat(40), "b".repeat(40), "c".repeat(40)];
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pulled < parts.length) controller.enqueue(new TextEncoder().encode(parts[pulled++]));
      else controller.close();
    },
  });
  assert.equal(await readBodyText(post(body), 64), null);
  assert.ok(pulled < parts.length, "the rest of the body is never read");
  assert.equal(await readBodyText(post(stream(["ab", "cd"])), 4), "abcd", "exactly the limit is allowed");
});

test("the unlock body byte limit holds with absent or understated Content-Length", async () => {
  const headerCases: Record<string, string>[] = [{}, { "content-length": "1" }];
  for (const headers of headerCases) {
    const exact = "secret=" + "a".repeat(UNLOCK_FORM_MAX_BYTES - 7);
    const text = await readBodyText(post(stream([exact]), headers), UNLOCK_FORM_MAX_BYTES);
    assert.equal(text, exact);
    assert.equal(new URLSearchParams(text!).get("secret"), "a".repeat(UNLOCK_FORM_MAX_BYTES - 7));
    assert.equal(await readBodyText(post(stream([exact, "a"]), headers), UNLOCK_FORM_MAX_BYTES), null);
  }
});

test("the unlock limit counts UTF-8 bytes instead of string characters", async () => {
  const exact = "é".repeat(UNLOCK_FORM_MAX_BYTES / 2);
  assert.equal(await readBodyText(post(stream([exact])), UNLOCK_FORM_MAX_BYTES), exact);
  assert.equal(await readBodyText(post(stream([exact, "é"])), UNLOCK_FORM_MAX_BYTES), null);
});

test("UTF-8 characters split across chunks decode after the complete body is read", async () => {
  const bytes = new TextEncoder().encode("secret=é🔑");
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
      controller.close();
    },
  });
  assert.equal(await readBodyText(post(body), UNLOCK_FORM_MAX_BYTES), "secret=é🔑");
  assert.equal(body.locked, false);
});

test("a large chunk is refused and cancelled without pulling the remaining body", async () => {
  let pulls = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls++;
      controller.enqueue(new Uint8Array(1024 * 1024));
    },
    cancel() {
      cancelled = true;
    },
  }, { highWaterMark: 0 });
  assert.equal(await readBodyText(post(body), UNLOCK_FORM_MAX_BYTES), null);
  assert.equal(pulls, 1);
  assert.equal(cancelled, true);
  assert.equal(body.locked, false);
});

test("a failed body read releases the reader lock", async () => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.error(new Error("body interrupted"));
    },
  });
  await assert.rejects(readBodyText(post(body), UNLOCK_FORM_MAX_BYTES), /body interrupted/);
  assert.equal(body.locked, false);
});
