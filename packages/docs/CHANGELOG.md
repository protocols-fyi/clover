# @sarim.garden/clover-docs

## 2.0.6

### Patch Changes

- b01d4df: Upgrade Zod to v4.1.13 and migrate from @anatine/zod-openapi to zod-openapi v5.4.0

  - Update type constraints from `AnyZodObject` to `z.ZodObject<any>` for Zod v4 compatibility
  - Update OpenAPI generation to use `zod-openapi` package instead of deprecated `@anatine/zod-openapi`
  - Update documentation to reflect package changes and correct type references
  - Fix spelling errors in documentation ("gurarantee" → "guarantee")

  Security updates:

  - Update vitest from 1.6.0 to 4.0.15 (fixes critical RCE vulnerability)
  - Update Next.js from 15.1.0 to 15.5.7 (fixes critical authorization bypass and RCE vulnerabilities)
  - Update @changesets/cli from 2.27.10 to 2.29.8 (fixes @babel/runtime, js-yaml, tmp vulnerabilities)
  - Update eslint from 7.32.0/8.57.1 to 9.39.1 across all packages (fixes js-yaml prototype pollution)
  - Update tsup from 7.2.0 to 8.5.1 (fixes glob CLI injection and esbuild vulnerabilities)
  - Update fumadocs packages to v14.7.7 (fixes image-size DoS vulnerability)
  - Resolved all critical and high-severity vulnerabilities (3 critical + 3 high → 0 critical + 0 high)
  - Remaining: 2 low-severity ReDoS issues in brace-expansion (transitive dev dependencies)

## 2.0.5

### Patch Changes

- bb94bca: Fix images in docs not loading

## 2.0.4

### Patch Changes

- 5f36cdc: Patch versions to trigger build because of broken actions workflow.

## 2.0.3

### Patch Changes

- 7cf8932: Fix broken build release. Update docs to fix issues with docs build.

## 2.0.2

### Patch Changes

- 40a16b8: Improve error logging. Add request path and method prefixes to server logs for better traceability. Enhance error descriptions to facilitate debugging.

## 2.0.1

### Patch Changes

- c02b2f5: Introduce new logger that can be swapped with a custom logger when using the package.

## 2.0.0

### Major Changes

- 21ea1e0: Replaced nextra with fumadocs

## 1.2.1

### Patch Changes

- 232dbde: Add new sendError helper in the handler that allows an error response to be easily retruned.

## 1.2.0

### Minor Changes

- 5d52e2a: Add more documentation

## 1.1.0

### Minor Changes

- 840789b: `makeRequestHandler` now exports `clientConfig` instead of `clientTypes` for clarity

## 1.0.0

### Major Changes

- 203f97a: Release initial versions of packages
