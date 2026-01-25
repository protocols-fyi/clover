---
"@protocols-fyi/clover": minor
---

Enhanced authentication handling with auth context support

- The `authenticate` function now returns `{ authenticated: true, context: TAuthContext }` or `{ authenticated: false, reason: string }` instead of a boolean
- The `run` callback now receives `authContext` containing the context returned from authentication
- Invalid JSON request bodies now return a 400 error with message instead of silently treating as empty object
- Empty request bodies are still treated as valid empty objects
