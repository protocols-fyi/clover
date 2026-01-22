---
"@protocols-fyi/clover": patch
---

**SECURITY FIX**: Fix authentication bypass vulnerability where errors thrown by the `authenticate` function would allow requests to proceed instead of being rejected.

Previously, if your `authenticate` callback threw an error (e.g., database connection failure, auth service timeout), the request would be allowed through ("fail open"). This is a security vulnerability. Now, authentication errors correctly return a 401 response ("fail closed").

**Breaking change for buggy code**: If your `authenticate` function throws errors that you were unknowingly relying on to allow requests through, those requests will now correctly return 401. This is the intended secure behavior.

Also includes:
- Improved error message when path parameters are missing from input schema (e.g., `Path parameter "id" in "/api/posts/:id" is not defined in the input schema`)
- Added OpenAPI schema generation via `buildOpenAPIPathsObject` - each route now exposes an `openAPIPathsObject` property
- Refactored `makeRequestHandler` internals: extracted `handleAuthentication` and `validateInput` helper functions for better readability
- Added tests for authentication behavior (verify `authenticate` is called, verify `run` is not called when auth fails)
