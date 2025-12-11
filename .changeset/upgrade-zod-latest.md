---
"@protocols-fyi/clover": minor
"@protocols-fyi/clover-docs": patch
---

Upgrade Zod to v4.1.13 and migrate from @anatine/zod-openapi to zod-openapi v5.4.0

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
