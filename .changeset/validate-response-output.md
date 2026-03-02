---
"@protocols-fyi/clover": minor
---

Validate sendOutput and sendError responses with Zod before serializing

Output responses are now parsed through the output schema and error responses through
`errorResponseSchema`. This ensures API compliance by validating response shapes and
stripping any excess fields not defined in the schema. Invalid output returns a 500
with an error-level log.
