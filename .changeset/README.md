# Changesets

Every change to a published package under `packages/*` needs a changeset:

```bash
pnpm changeset
```

Pick the packages, the bump (patch/minor/major) and write one line for the changelog. Commit the generated `.changeset/*.md` file with the change.

- `@sahan-sac/ai-core`, `@sahan-sac/blog-kit` and `@sahan-sac/chat-kit` are a **fixed** group: they always release together under one version.
- `@sahan-sac/auth-kit` and `@sahan-sac/media-kit` are versioned independently.

On `master`, `.github/workflows/release.yml` opens a "Version packages" pull request that bumps versions and writes the changelogs. Merging it publishes to npm through Trusted Publishing (no npm token in the repository).
