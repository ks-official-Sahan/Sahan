---
"@sahan-sac/auth-kit": patch
---

`auth-kit doctor` and `auth-kit db upgrade` accept a hyphenated schema name such as `admin-panel` (from `--schema` or the URL's `schema` parameter). The name is always used double-quoted in `SET search_path`, so a hyphen is safe; a quote, dot, space or a name over 63 characters is still refused.
