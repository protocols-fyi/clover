---
"@protocols-fyi/clover": patch
---

Fix TypeScript compatibility issue with Zod v4 type constraints

- Update generic constraints from `z.ZodObject<any>` to `z.ZodObject<any, any>` to properly support Zod v4's type system
- Fixes TypeScript errors when using handlers with `.strict()`, `.passthrough()`, or other ZodObject configurations
- Update documentation to reflect correct Zod v4 type syntax
- Add tests demonstrating handler wrapper patterns (like authenticated handlers)
- This corrects the incomplete migration in v2.5.0 that caused type compatibility issues in downstream projects
