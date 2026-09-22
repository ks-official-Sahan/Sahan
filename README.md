## Sahan Sachintha

## Admin panel

A hidden admin panel at `/admin` runs content, collections, blog, media,
leads and the chatbot for this site. Setup, sign-in, roles, secret rotation
and Vercel environment configuration are in [`docs/admin.md`](docs/admin.md).
The architecture decision record is in
[`docs/plan/admin-cms-adr.md`](docs/plan/admin-cms-adr.md), and the last
security review is in
[`docs/plan/admin-cms-security-review.md`](docs/plan/admin-cms-security-review.md).

Quick start: copy `.env.example` to `.env.local`, fill in `DATABASE_URL` and
the variables marked `(admin)`, run migrations against schema `sahan`, then
visit `/admin?secret=<ADMIN_LOGIN_UNLOCK_SECRET>` once to unlock and sign in
with the seeded owner account. Full detail in `docs/admin.md`.
