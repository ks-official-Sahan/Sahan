# Published package compatibility

Every package in `packages/` is published from its `dist/` output. The source
paths in each workspace manifest are for monorepo development; `pnpm pack`
applies `publishConfig` before it creates the consumer artifact.

All packages currently target Node.js 20 or newer and publish ESM only. They
do not expose CommonJS `require` conditions. Use `import` from an ESM project,
or use a bundler that handles ESM dependencies. Browser-safe subpaths and
optional framework peers are documented in each package README.

CI packs every package and checks the actual tarballs: all declared export
targets must exist, workspace dependency protocols must be rewritten, public
entry points must import from a consumer fixture, the auth-kit core must not
pull in React, and the published Auth.js declaration subpath must typecheck.

## CMS package boundary

The app's CMS is not currently a portable package. Its server services depend
on this app's Prisma models, permission names, audit transactions, page
registry, Next.js cache tags and route revalidation. Installing those modules
in another project would also import app paths and app-specific assumptions.
Keep the application layer here. A reusable `@sahan-sac/cms-kit` should start
with framework-neutral content schemas/contracts, safe rich-text handling,
slug/cursor rules, revision lifecycle rules, and storage/cache/auth adapter
interfaces. Add database adapters and a Next.js integration as separate
optional entry points, then prove the package from its packed tarball in a
consumer fixture before calling it a production headless CMS.
