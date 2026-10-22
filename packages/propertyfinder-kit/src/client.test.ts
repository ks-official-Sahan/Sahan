import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPropertyFinderClient, propertyFinderEnv } from "./client";

const AUTH_URL = "https://auth.test/v1/auth/token";
const BASE_URL = "https://atlas.test";

/** Fake transport: auth returns a token; listings return one result. */
function fakeFetch() {
  const calls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    calls.push(url);
    if (url === AUTH_URL) {
      return new Response(JSON.stringify({ accessToken: "tok", expiresIn: 1800 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({
        results: [{ id: "123" }],
        pagination: { total: 1, page: 1, perPage: 50, totalPages: 1 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
  return { calls, fetchImpl };
}

function makeClient(fetchImpl: typeof fetch) {
  return createPropertyFinderClient({
    apiKey: "key",
    apiSecret: "secret",
    fetch: fetchImpl,
    baseUrl: BASE_URL,
    authUrl: AUTH_URL,
  });
}

describe("propertyFinderEnv", () => {
  it("returns null when either value is missing or blank", () => {
    assert.equal(propertyFinderEnv({}), null);
    assert.equal(propertyFinderEnv({ PF_API_KEY: "k", PF_API_SECRET: "  " }), null);
    assert.equal(propertyFinderEnv({ PF_API_KEY: "k" }), null);
  });

  it("returns keys when both are set", () => {
    assert.deepEqual(propertyFinderEnv({ PF_API_KEY: "k", PF_API_SECRET: "s" }), {
      apiKey: "k",
      apiSecret: "s",
    });
  });
});

describe("createPropertyFinderClient token cache", () => {
  it("fetches the token once and reuses it across calls", async () => {
    const { calls, fetchImpl } = fakeFetch();
    const client = makeClient(fetchImpl);

    const first = await client.fetchListingById("123");
    const second = await client.fetchListingById("123");

    assert.equal(first?.id, "123");
    assert.equal(second?.id, "123");
    assert.equal(calls.filter((url) => url === AUTH_URL).length, 1);
  });

  it("invalidateToken forces a new token fetch", async () => {
    const { calls, fetchImpl } = fakeFetch();
    const client = makeClient(fetchImpl);

    await client.getToken();
    client.invalidateToken();
    await client.getToken();

    assert.equal(calls.filter((url) => url === AUTH_URL).length, 2);
  });
});
