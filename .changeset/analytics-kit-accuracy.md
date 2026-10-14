---
"@sahan-sac/analytics-kit": minor
---

Count days on the owner's calendar and keep 404s out of the numbers. `createAnalyticsStore` takes a `timeZone` (IANA, default UTC); day buckets and the daily visitor salt share that boundary, days are stepped on the calendar so daylight-saving changes never skip or repeat one, and an unknown zone falls back to UTC with a warning. New `dayIn()` and `validTimeZone()` helpers, and `lastDays()` takes an optional zone. The browser beacon gains `ignorePageView(path)` for not-found pages and now sends a view one microtask later so that call can land in the same render.
