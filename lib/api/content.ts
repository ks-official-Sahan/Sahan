/** Public, credential-free read API. Wildcard CORS is safe because this surface returns public published content only. */
export const CONTENT_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const CONTENT_CACHE_HEADERS = {
  ...CONTENT_CORS_HEADERS,
  "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
};

export const CONTENT_NO_STORE_HEADERS = {
  ...CONTENT_CORS_HEADERS,
  "Cache-Control": "no-store",
};
