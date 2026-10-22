// ─────────────────────────────────────────────────────────────────────────────
// Property Finder Enterprise API – HTTP Client (Atlas API)
//
// Aligned with PF Atlas API (api-docs.propertyfinder.net):
//   GET /v1/listings → { results: [...], pagination: {...} }
//   Query params use filter[] syntax.
//
// Factory, not a singleton: every client owns its own JWT token cache, so two
// accounts (or two tests) never share state. Credentials are parameters; the
// package never reads env vars. Server-to-server only.
//
// Auth (JWT token manager):
//   Token expires in 30 min; we refresh 60s before expiry. Concurrent callers
//   share one in-flight refresh. For multi-instance deployments, layer a shared
//   cache (Redis, etc.) in the app around `getToken()` / `invalidateToken()`.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  PFListing,
  PFListingsParams,
  PFListingsResponse,
  PFLocation,
  PFTokenCache,
  PFTokenResponse,
} from "./types";

const PF_BASE_URL = "https://atlas.propertyfinder.com";
const PF_AUTH_URL = "https://atlas.propertyfinder.com/v1/auth/token";
const DEFAULT_PER_PAGE = 50;
const MAX_RETRIES = 2;
/** Bound hung PF requests so prerender/runtime can fail soft instead of hanging. */
const PF_FETCH_TIMEOUT_MS = 20_000;
/** Refresh token 60 seconds before actual expiry to avoid race conditions */
const REFRESH_BUFFER_MS = 60_000;
/** Fail fast when PF is unreachable (default undici connect timeout is ~10s). */
const AUTH_TIMEOUT_MS = 5_000;
/**
 * Next.js fetch cache hint. Ignored by plain Node fetch; the Next runtime reads
 * it, so it stays. Spread (not literal) so the non-DOM RequestInit type accepts it.
 */
const NO_STORE = { cache: "no-store" } as const;

export interface PropertyFinderClientOptions {
  apiKey: string;
  apiSecret: string;
  /** Injected transport. Defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /** Atlas API origin. Defaults to https://atlas.propertyfinder.com. */
  baseUrl?: string;
  /** Token endpoint. Defaults to `${baseUrl}/v1/auth/token`. */
  authUrl?: string;
  /** Receives debug-level notices (e.g. a listing was retrieved). Optional. */
  log?: { warn(message: string, detail?: unknown): void };
}

/**
 * Read PF credentials from an env-like object (pass the app's env object).
 * Returns null when either value is missing or blank.
 */
export function propertyFinderEnv(
  env: Record<string, string | undefined>,
): { apiKey: string; apiSecret: string } | null {
  const apiKey = env.PF_API_KEY;
  const apiSecret = env.PF_API_SECRET;
  if (!apiKey?.trim() || !apiSecret?.trim()) return null;
  return { apiKey, apiSecret };
}

// ─── Build query string ─────────────────────────────────────────────────────

function buildListingsQuery(params: PFListingsParams): string {
  const qs = new URLSearchParams();

  qs.set("page", String(params.page ?? 1));
  qs.set("perPage", String(params.perPage ?? DEFAULT_PER_PAGE));

  if (params.draft !== undefined) qs.set("draft", String(params.draft));
  if (params.archived !== undefined)
    qs.set("archived", String(params.archived));
  if (params.orderBy) qs.set("orderBy", params.orderBy);

  if (params.sortDir && params.orderBy) {
    qs.set(`sort[${params.orderBy}]`, params.sortDir);
  }

  if (params.filterState) qs.set("filter[state]", params.filterState);
  if (params.filterCategory) qs.set("filter[category]", params.filterCategory);
  if (params.filterOfferingType)
    qs.set("filter[offeringType]", params.filterOfferingType);
  if (params.filterType) qs.set("filter[type]", params.filterType);
  if (params.filterLocationId)
    qs.set("filter[locationId]", params.filterLocationId);
  if (params.filterAssignedToId)
    qs.set("filter[assignedToId]", params.filterAssignedToId);
  if (params.filterBedrooms) qs.set("filter[bedrooms]", params.filterBedrooms);
  if (params.filterBathrooms)
    qs.set("filter[bathrooms]", params.filterBathrooms);
  if (params.filterCompletionStatus)
    qs.set("filter[completionStatus]", params.filterCompletionStatus);
  if (params.filterFurnishingType)
    qs.set("filter[furnishingType]", params.filterFurnishingType);
  if (params.filterPriceFrom != null)
    qs.set("filter[price][from]", String(params.filterPriceFrom));
  if (params.filterPriceTo != null)
    qs.set("filter[price][to]", String(params.filterPriceTo));
  if (params.filterIds) qs.set("filter[ids]", params.filterIds);
  if (params.filterReference)
    qs.set("filter[reference]", params.filterReference);

  return qs.toString();
}

// ─── Locations ────────────────────────────────────────────────────────────────

export interface PFFetchLocationsOptions {
  id?: string;
  ids?: string[];
  search?: string;
  page?: number;
  perPage?: number;
  lang?: "en" | "ar";
}

interface PFLocationsApiResponse {
  data?: PFLocation[];
  pagination?: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
    nextPage: number | null;
    prevPage: number | null;
  };
}

// ─── Leads (GET /v1/leads, leads:read) ───────────────────────────────────────

export type PFLeadsParams = {
  page?: number;
  perPage?: number;
  createdAtFrom?: string;
  createdAtTo?: string;
  status?: string;
  listingReference?: string;
  senderPhone?: string;
  senderEmail?: string;
};

export type PFLeadRecord = Record<string, unknown>;

export type PFLeadsResponse = {
  results: PFLeadRecord[];
  pagination: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
};

function buildLeadsQuery(params: PFLeadsParams): string {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page ?? 1));
  qs.set("perPage", String(params.perPage ?? DEFAULT_PER_PAGE));
  if (params.createdAtFrom) qs.set("filter[createdAtFrom]", params.createdAtFrom);
  if (params.createdAtTo) qs.set("filter[createdAtTo]", params.createdAtTo);
  if (params.status) qs.set("filter[status]", params.status);
  if (params.listingReference) qs.set("filter[listingReference]", params.listingReference);
  if (params.senderPhone) qs.set("filter[senderPhone]", params.senderPhone);
  if (params.senderEmail) qs.set("filter[senderEmail]", params.senderEmail);
  return qs.toString();
}

// ─── Webhook subscriptions (scope: webhooks:full_access) ─────────────────────

export type PFWebhookSubscriptionEventId =
  | "user.created"
  | "user.updated"
  | "user.deleted"
  | "user.activated"
  | "user.deactivated"
  | "lead.created"
  | "lead.updated"
  | "lead.assigned"
  | "publicProfile.verification.approved"
  | "publicProfile.verification.rejected"
  | "listing.published"
  | "listing.unpublished"
  | "listing.action"
  | "listing.publishFailed"
  | "listing.systemUpdated";

export interface PFWebhookSubscription {
  eventId: string;
  url: string;
  createdAt?: string;
}

/** Events Valorem should subscribe to for listings + leads sync. */
export const PF_DEFAULT_WEBHOOK_EVENTS: PFWebhookSubscriptionEventId[] = [
  "listing.published",
  "listing.unpublished",
  "listing.action",
  "listing.systemUpdated",
  "listing.publishFailed",
  "lead.created",
  "lead.updated",
  "lead.assigned",
];

/**
 * PF list responses often return composite ids like
 * `lead.created_bd5cf4d5-b2c8-4452-95a4-a5d01038b623` — strip the UUID suffix.
 */
export function normalizeWebhookEventType(eventId: string): string {
  const trimmed = eventId.trim();
  const uuidSuffix =
    /_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return trimmed.replace(uuidSuffix, "");
}

function normalizeCallbackUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Build a Property Finder client. Each call returns an independent client with
 * its own token cache and in-flight refresh, so nothing is shared at module level.
 */
export function createPropertyFinderClient(options: PropertyFinderClientOptions) {
  const doFetch: typeof fetch =
    options.fetch ?? ((input, init) => fetch(input, init));
  const baseUrl = options.baseUrl ?? PF_BASE_URL;
  const authUrl = options.authUrl ?? PF_AUTH_URL;

  // Per-client state — deliberately inside the closure, not module-level.
  let tokenCache: PFTokenCache | null = null;
  // Deduplicate concurrent refresh calls
  let refreshPromise: Promise<string> | null = null;

  // ─── Auth ─────────────────────────────────────────────────────────────────

  async function fetchFreshToken(): Promise<string> {
    if (!options.apiKey || !options.apiSecret) {
      throw new Error(
        "[PF Auth] apiKey and apiSecret are required.",
      );
    }

    const res = await doFetch(authUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ apiKey: options.apiKey, apiSecret: options.apiSecret }),
      // No next.js cache on auth calls — we manage it ourselves
      ...NO_STORE,
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `[PF Auth] Token fetch failed: ${res.status} ${res.statusText} — ${body}`
      );
    }

    const data = (await res.json()) as Partial<PFTokenResponse> | null;
    // The cast is compile-time only: never cache a token the API did not send.
    if (!data || typeof data.accessToken !== "string" || !data.accessToken || typeof data.expiresIn !== "number" || !Number.isFinite(data.expiresIn) || data.expiresIn <= 0) {
      throw new Error("[PF Auth] Token response is missing accessToken or a positive expiresIn.");
    }

    tokenCache = {
      token: data.accessToken,
      // expiresIn is in seconds; subtract buffer before marking as expired
      expiresAt: Date.now() + data.expiresIn * 1000 - REFRESH_BUFFER_MS,
    };

    return tokenCache.token;
  }

  /**
   * Returns a valid Bearer token. Fetches a new one only when expired or absent.
   * Thread-safe: concurrent callers share the same refresh promise.
   */
  async function getToken(): Promise<string> {
    const now = Date.now();

    if (tokenCache && tokenCache.expiresAt - now > 0) {
      return tokenCache.token;
    }

    // Deduplicate concurrent refresh requests
    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = fetchFreshToken().finally(() => {
      refreshPromise = null;
    });

    return refreshPromise;
  }

  /** Manually invalidate the cached token (e.g. after a 401 response) */
  function invalidateToken(): void {
    tokenCache = null;
  }

  // ─── Core fetch wrapper ───────────────────────────────────────────────────

  async function pfFetch<T>(
    path: string,
    fetchOptions: RequestInit = {},
    attempt = 0,
  ): Promise<T> {
    const token = await getToken();

    const res = await doFetch(`${baseUrl}${path}`, {
      ...fetchOptions,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...fetchOptions.headers,
      },
      ...NO_STORE,
      signal: fetchOptions.signal ?? AbortSignal.timeout(PF_FETCH_TIMEOUT_MS),
    });

    if (res.status === 401 && attempt < MAX_RETRIES) {
      invalidateToken();
      return pfFetch<T>(path, fetchOptions, attempt + 1);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `[PF Client] ${fetchOptions.method ?? "GET"} ${path} → ${res.status} ${res.statusText}: ${body}`,
      );
    }

    if (res.status === 204 || res.headers.get("content-length") === "0") {
      return undefined as T;
    }

    const text = await res.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  // ─── Listings ─────────────────────────────────────────────────────────────

  async function fetchListingsPage(
    params: PFListingsParams = {},
  ): Promise<PFListingsResponse> {
    const qs = buildListingsQuery(params);
    const raw = await pfFetch<Record<string, unknown>>(`/v1/listings?${qs}`);

    const results = raw.results;
    const pagination = raw.pagination as
      | PFListingsResponse["pagination"]
      | undefined;

    if (!Array.isArray(results)) {
      console.error(
        "[PF Client] Unexpected response shape. Keys:",
        Object.keys(raw),
        "results type:",
        typeof results,
      );
      throw new Error(
        `[PF Client] Unexpected listings payload: expected results array but received ${
          results === null ? "null" : typeof results
        }. Response keys: [${Object.keys(raw).join(", ")}]`,
      );
    }

    return {
      results: results as PFListing[],
      pagination: pagination ?? {
        total: results.length,
        page: params.page ?? 1,
        perPage: params.perPage ?? DEFAULT_PER_PAGE,
        totalPages: 1,
      },
    };
  }

  /**
   * Fetch ALL published listings (draft=false is default).
   * Paginates automatically. Runs remaining pages in parallel once total is known.
   */
  async function fetchAllListings(
    baseParams: Omit<PFListingsParams, "page"> = {},
  ): Promise<PFListing[]> {
    const params: PFListingsParams = {
      ...baseParams,
      perPage: DEFAULT_PER_PAGE,
      page: 1,
    };

    const firstPage = await fetchListingsPage(params);
    const allListings = [...firstPage.results];
    const totalPages = firstPage.pagination.totalPages;

    if (totalPages > 1) {
      const remainingPages = Array.from(
        { length: totalPages - 1 },
        (_, i) => i + 2,
      );

      const pages = await Promise.all(
        remainingPages.map((page) => fetchListingsPage({ ...params, page })),
      );

      for (const page of pages) {
        allListings.push(...page.results);
      }
    }

    console.info(
      `[PF Client] filter[state]=${params.filterState ?? "(none)"} → API reports total=${firstPage.pagination.total}, pages=${totalPages}, collected=${allListings.length}`,
    );

    return allListings;
  }

  /**
   * Fetch a single listing by its PF string ID.
   * Direct /v1/listings/:id endpoint is broken/forbidden for this account,
   * so we use the standard listings query with filter[ids] to get the single listing.
   */
  async function fetchListingById(id: string): Promise<PFListing | null> {
    try {
      const page = await fetchListingsPage({ filterIds: id });
      const listing = page.results[0] ?? null;
      if (listing) {
        options.log?.warn(`[PF Client] Successfully retrieved listing ${id}`);
        return listing;
      }
    } catch (err) {
      console.error(
        `[PF Client] fetchListingsPage({ filterIds: ${id} }) failed:`,
        err instanceof Error ? err.message : err,
      );
    }

    return null;
  }

  /**
   * Low-level call to PF `/v1/locations`. Returns only the `data` array.
   * Caller is responsible for any cross-request caching.
   */
  async function fetchLocations(
    fetchLocationsOptions: PFFetchLocationsOptions = {},
  ): Promise<PFLocation[]> {
    const qs = new URLSearchParams();
    const ids =
      fetchLocationsOptions.ids && fetchLocationsOptions.ids.length > 0
        ? fetchLocationsOptions.ids.join(",")
        : fetchLocationsOptions.id;
    if (ids) qs.set("filter[id]", ids);
    if (fetchLocationsOptions.search) qs.set("search", fetchLocationsOptions.search);
    if (fetchLocationsOptions.page) qs.set("page", String(fetchLocationsOptions.page));
    if (fetchLocationsOptions.perPage) qs.set("perPage", String(fetchLocationsOptions.perPage));

    const raw = await pfFetch<PFLocationsApiResponse>(
      `/v1/locations?${qs.toString()}`,
      {
        headers: {
          "Accept-Language": fetchLocationsOptions.lang ?? "en",
        },
      },
    );

    return raw.data ?? [];
  }

  // ─── Leads ────────────────────────────────────────────────────────────────

  async function fetchLeadsPage(
    params: PFLeadsParams = {},
  ): Promise<PFLeadsResponse> {
    const qs = buildLeadsQuery(params);
    const raw = await pfFetch<Record<string, unknown>>(`/v1/leads?${qs}`);
    const results = Array.isArray(raw.results)
      ? (raw.results as PFLeadRecord[])
      : Array.isArray(raw.data)
        ? (raw.data as PFLeadRecord[])
        : [];
    const pagination = raw.pagination as PFLeadsResponse["pagination"] | undefined;
    return {
      results,
      pagination: pagination ?? {
        total: results.length,
        page: params.page ?? 1,
        perPage: params.perPage ?? DEFAULT_PER_PAGE,
        totalPages: 1,
      },
    };
  }

  async function fetchLeadById(id: string): Promise<PFLeadRecord | null> {
    try {
      const raw = await pfFetch<Record<string, unknown>>(`/v1/leads/${encodeURIComponent(id)}`);
      if (raw && typeof raw === "object" && (raw.id != null || raw.data)) {
        const nested = raw.data;
        if (nested && typeof nested === "object" && !Array.isArray(nested)) {
          return nested as PFLeadRecord;
        }
        return raw as PFLeadRecord;
      }
    } catch (err) {
      console.warn(
        "[PF Client] GET /v1/leads/:id failed:",
        err instanceof Error ? err.message : err,
      );
    }
    return null;
  }

  // ─── Webhook subscriptions ────────────────────────────────────────────────

  async function listWebhookSubscriptions(opts?: {
    eventType?: string;
  }): Promise<PFWebhookSubscription[]> {
    const qs = opts?.eventType
      ? `?eventType=${encodeURIComponent(opts.eventType)}`
      : "";
    const raw = await pfFetch<{ data?: PFWebhookSubscription[] } | PFWebhookSubscription[]>(
      `/v1/webhooks${qs}`,
    );
    if (Array.isArray(raw)) return raw;
    return Array.isArray(raw.data) ? raw.data : [];
  }

  /**
   * Subscribe a callback URL to a PF event.
   * `secret` is optional (≤32 chars); when set, PF signs deliveries with HMAC-SHA256
   * in the X-Signature header — store the same value as PF_WEBHOOK_SECRET.
   */
  async function subscribeWebhookEvent(input: {
    eventId: PFWebhookSubscriptionEventId | string;
    callbackUrl: string;
    secret?: string;
  }): Promise<PFWebhookSubscription> {
    if (input.secret && input.secret.length > 32) {
      throw new Error(
        "[PF Client] Webhook secret must be ≤32 characters (PF Enterprise API limit)",
      );
    }
    return pfFetch<PFWebhookSubscription>("/v1/webhooks", {
      method: "POST",
      body: JSON.stringify({
        eventId: input.eventId,
        callbackUrl: input.callbackUrl,
        ...(input.secret ? { secret: input.secret } : {}),
      }),
    });
  }

  /**
   * Delete by the subscription id returned from GET /v1/webhooks
   * (often `eventType_<uuid>`, not bare `eventType`).
   */
  async function deleteWebhookSubscription(
    eventId: string,
  ): Promise<void> {
    await pfFetch<void>(`/v1/webhooks/${encodeURIComponent(eventId)}`, {
      method: "DELETE",
    });
  }

  async function ensureWebhookSubscriptions(input: {
    callbackUrl: string;
    secret?: string;
    eventIds?: Array<PFWebhookSubscriptionEventId | string>;
  }): Promise<{
    subscribed: string[];
    skipped: string[];
    failed: Array<{ eventId: string; error: string }>;
  }> {
    const eventIds = input.eventIds ?? PF_DEFAULT_WEBHOOK_EVENTS;
    const targetUrl = normalizeCallbackUrl(input.callbackUrl);
    const existing = await listWebhookSubscriptions().catch(() => []);

    const alreadyForCallback = new Set(
      existing
        .filter((row) => normalizeCallbackUrl(row.url) === targetUrl)
        .map((row) => normalizeWebhookEventType(row.eventId)),
    );

    const subscribed: string[] = [];
    const skipped: string[] = [];
    const failed: Array<{ eventId: string; error: string }> = [];

    for (const eventId of eventIds) {
      if (alreadyForCallback.has(eventId)) {
        skipped.push(eventId);
        continue;
      }
      try {
        await subscribeWebhookEvent({
          eventId,
          callbackUrl: input.callbackUrl,
          secret: input.secret,
        });
        subscribed.push(eventId);
        alreadyForCallback.add(eventId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // Race / composite-id miss: treat same-URL conflict as already present.
        if (/\b409\b/.test(message) || /already exists/i.test(message)) {
          skipped.push(eventId);
          alreadyForCallback.add(eventId);
          continue;
        }
        failed.push({ eventId, error: message });
      }
    }

    return { subscribed, skipped, failed };
  }

  // ─── Public profile / SuperAgent statistics (scope: statistics:read) ──────

  async function fetchPublicProfileStats(opts?: {
    page?: number;
    perPage?: number;
    search?: string;
  }): Promise<unknown> {
    const qs = new URLSearchParams();
    qs.set("page", String(opts?.page ?? 1));
    qs.set("perPage", String(opts?.perPage ?? 50));
    if (opts?.search) qs.set("search", opts.search);
    return pfFetch(`/v1/stats/public-profiles?${qs}`);
  }

  async function fetchSuperAgentStats(opts?: {
    page?: number;
    perPage?: number;
    search?: string;
  }): Promise<unknown> {
    const qs = new URLSearchParams();
    qs.set("page", String(opts?.page ?? 1));
    qs.set("perPage", String(opts?.perPage ?? 50));
    if (opts?.search) qs.set("search", opts.search);
    return pfFetch(`/v1/stats/superagent-stats?${qs}`);
  }

  return {
    getToken,
    invalidateToken,
    fetchListingsPage,
    fetchAllListings,
    fetchListingById,
    fetchLocations,
    fetchLeadsPage,
    fetchLeadById,
    listWebhookSubscriptions,
    subscribeWebhookEvent,
    deleteWebhookSubscription,
    ensureWebhookSubscriptions,
    fetchPublicProfileStats,
    fetchSuperAgentStats,
  };
}

export type PropertyFinderClient = ReturnType<typeof createPropertyFinderClient>;
