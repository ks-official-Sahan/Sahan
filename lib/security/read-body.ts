// Reads a request body up to a byte limit, so an oversized body is refused
// before it is buffered: a Content-Length over the limit is refused without
// reading, and a streamed body (no or a false Content-Length) stops at the
// first chunk past the limit.

/** The body as text, or null when it is larger than `limit` bytes. */
export async function readBodyText(request: Request, limit: number): Promise<string | null> {
  const header = request.headers.get("content-length");
  if (header !== null && Number(header) > limit) return null;
  if (!request.body) return "";

  const reader = request.body.getReader();
  // Keep at most the limit plus one byte to detect overflow.
  const bytes = new Uint8Array(limit + 1);
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value.subarray(0, bytes.length - size);
      bytes.set(chunk, size);
      size += chunk.byteLength;
      if (size > limit) {
        await reader.cancel();
        return null;
      }
    }
  } finally {
    reader.releaseLock();
  }

  return new TextDecoder().decode(bytes.subarray(0, size));
}
