---
"@protocols-fyi/clover": patch
---

Fix OpenAPI path parameter syntax in generated specs

- Convert Express-style path parameters (`:param`) to OpenAPI-standard syntax (`{param}`) in `openAPIPathsObject`
- Add `toOpenAPIPath()` utility function for path conversion
- Fixes compatibility with OpenAPI validators and documentation tools (e.g., Mintlify) that expect `{param}` format
