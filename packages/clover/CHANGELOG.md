# @sarim.garden/clover

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
