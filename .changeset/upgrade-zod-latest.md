---
"@protocols-fyi/clover": minor
"@protocols-fyi/clover-docs": patch
---

Upgrade Zod to v4.1.13 and migrate from @anatine/zod-openapi to zod-openapi v5.4.0

- Update type constraints from `AnyZodObject` to `z.ZodObject<any>` for Zod v4 compatibility
- Update OpenAPI generation to use `zod-openapi` package instead of deprecated `@anatine/zod-openapi`
- Update documentation to reflect package changes and correct type references
- Fix spelling errors in documentation ("gurarantee" → "guarantee")
