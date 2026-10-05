---
"@sahan-sac/auth-kit": patch
---

Every subpath export now has a `default` condition beside `import`, so CommonJS loaders can use the package through Node's `require(esm)`. drizzle-kit loads `drizzle.config.ts` and the schema through `require`, and it failed with `ERR_PACKAGE_PATH_NOT_EXPORTED` on a schema that imports `@sahan-sac/auth-kit/drizzle`.
