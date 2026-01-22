# @sarim.garden/clover

## 2.6.1

### Patch Changes

- 8dde03f: **SECURITY FIX**: Fix authentication bypass vulnerability where errors thrown by the `authenticate` function would allow requests to proceed instead of being rejected.

  Previously, if your `authenticate` callback threw an error (e.g., database connection failure, auth service timeout), the request would be allowed through ("fail open"). This is a security vulnerability. Now, authentication errors correctly return a 401 response ("fail closed").

  **Breaking change for buggy code**: If your `authenticate` function throws errors that you were unknowingly relying on to allow requests through, those requests will now correctly return 401. This is the intended secure behavior.

  Also includes:

  - Improved error message when path parameters are missing from input schema (e.g., `Path parameter "id" in "/api/posts/:id" is not defined in the input schema`)
  - Added OpenAPI schema generation via `buildOpenAPIPathsObject` - each route now exposes an `openAPIPathsObject` property
  - Refactored `makeRequestHandler` internals: extracted `handleAuthentication` and `validateInput` helper functions for better readability
  - Added tests for authentication behavior (verify `authenticate` is called, verify `run` is not called when auth fails)

## 2.6.0

### Minor Changes

- d99fa0b: Add support for OpenAPI examples and descriptions using Zod's `.meta()` method. You can now add examples and descriptions to any schema field, including query parameters, path parameters, request bodies, and responses.

## 2.5.3

### Patch Changes

- 2a71193: Fix brace-expansion ReDoS vulnerability (CVE-2025-5889) via pnpm overrides

## 2.5.2

### Patch Changes

- 7908591: Fix OpenAPI path parameter syntax in generated specs

  - Convert Express-style path parameters (`:param`) to OpenAPI-standard syntax (`{param}`) in `openAPIPathsObject`
  - Add `toOpenAPIPath()` utility function for path conversion
  - Fixes compatibility with OpenAPI validators and documentation tools (e.g., Mintlify) that expect `{param}` format

## 2.5.1

### Patch Changes

- 0a72193: Fix TypeScript compatibility issue with Zod v4 type constraints

  - Update generic constraints from `z.ZodObject<any>` to `z.ZodObject<any, any>` to properly support Zod v4's type system
  - Fixes TypeScript errors when using handlers with `.strict()`, `.passthrough()`, or other ZodObject configurations
  - Update documentation to reflect correct Zod v4 type syntax
  - Add tests demonstrating handler wrapper patterns (like authenticated handlers)
  - This corrects the incomplete migration in v2.5.0 that caused type compatibility issues in downstream projects

## 2.5.0

### Minor Changes

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

## 2.4.1

### Patch Changes

- Removed security field to fix Swagger errors.

## 2.4.0

### Minor Changes

- 695a561: Gracefully handle and log non json data in body of POST, PUT or PATCH request. Non JSON data is now treated as an empty object.

## 2.3.4

### Patch Changes

- 5f36cdc: Patch versions to trigger build because of broken actions workflow.

## 2.3.3

### Patch Changes

- 7cf8932: Fix broken build release. Update docs to fix issues with docs build.

## 2.3.2

### Patch Changes

- 40a16b8: Improve error logging. Add request path and method prefixes to server logs for better traceability. Enhance error descriptions to facilitate debugging.

## 2.3.1

### Patch Changes

- c02b2f5: Introduce new logger that can be swapped with a custom logger when using the package.

## 2.3.0

### Minor Changes

- d309e57: Improve sendError to take an object rather than seperate parameters.

## 2.2.1

### Patch Changes

- f2b1f67: Remove custom eslint config for clover project

## 2.2.0

### Minor Changes

- 232dbde: Add new sendError helper in the handler that allows an error response to be easily retruned.

## 2.1.4

### Patch Changes

- 2ca3e60: Fix issue where path parameters were not marked as required

## 2.1.3

### Patch Changes

- 7d4abd0: Remove typesVersions from package.json as this conflicts with the exports

## 2.1.2

### Patch Changes

- 96a2469: Update clover to build for both esm and cjs

## 2.1.1

### Patch Changes

- 734797d: Test patch of auto release

## 2.1.0

### Minor Changes

- f9aeedc: Add support for OpenAPI tags with makeRequestHandler

## 2.0.1

### Patch Changes

- 5d52e2a: Add more documentation

## 2.0.0

### Major Changes

- 840789b: `makeRequestHandler` now exports `clientConfig` instead of `clientTypes` for clarity

## 1.0.0

### Major Changes

- 203f97a: Release initial versions of packages
