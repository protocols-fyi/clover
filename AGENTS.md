# Clover Agent Documentation

## Project Overview

TypeScript library for type-safe, self-documenting APIs using Zod + OpenAPI. WinterCG-compatible handlers: `(request: Request) => Promise<Response>`.

**Key Point**: Schema-driven architecture - Zod schemas define validation, types, AND OpenAPI docs automatically.

## Tech Stack

| Package              | Purpose                            |
| -------------------- | ---------------------------------- |
| Zod                  | Schema validation + type inference |
| @anatine/zod-openapi | Zod → OpenAPI conversion           |
| openapi3-ts          | OpenAPI types                      |
| path-to-regexp       | Path parameter extraction          |
| lodash.merge         | Response options merging           |
| tsup                 | Dual-format bundler (ESM + CJS)    |
| Vitest               | Testing                            |
| Turbo                | Monorepo orchestration             |
| Changesets           | Versioning                         |

## Project Structure

```
packages/
├── clover/                  # Main library
│   ├── src/
│   │   ├── server.ts        # makeRequestHandler() - core logic
│   │   ├── client.ts        # makeFetcher() - optional client
│   │   ├── utils.ts         # Path parsing, HTTP utilities
│   │   ├── logger.ts        # Pluggable logger (no-op by default)
│   │   ├── responses.ts     # commonReponses (NOTE: typo in code)
│   │   └── test.ts          # Test utilities
│   ├── dist/                # ESM (.js) + CJS (.cjs) outputs
│   └── tsup.config.ts       # Build config
└── docs/                    # Fumadocs Next.js site
```

## Critical Architecture Decisions

### 1. Request Cloning Pattern

**Handler makes THREE request clones** to avoid stream consumption issues:

- Clone 1: Authentication callback
- Clone 2: User's `run` function
- Clone 3: Logging/metadata

**Why**: Request streams can only be read once. Each concern needs independent access.

### 2. Input Resolution Heuristics

**Method determines input source** (automatic, no config needed):

- `GET`/`DELETE`: Input from **query params** only
- `POST`/`PUT`/`PATCH`: Input from **JSON body** only
- **Path params**: Always extracted and merged (override query/body)

### 3. Middleware-Less Validation

Validation happens INSIDE handlers, not as middleware. Single logical unit owns everything.

### 4. Pluggable Logger

- Default: No-op (silent by default)
- Set globally: `setLogger({ log: (level, message, meta) => {...} })`
- Applied to ALL handlers created after setting
- Interface: `ILogger = { log: (level, message, meta?) => void }`

### 5. OpenAPI Generation

Combine multiple routes manually:

```ts
const paths = [route1.openAPIPathsObject, route2.openAPIPathsObject].reduce(
  (acc, curr) => {
    Object.keys(curr).forEach((k) => (acc[k] = { ...acc[k], ...curr[k] }));
    return acc;
  },
  {}
);
```

### 6. Error Responses

Standard responses object: `commonReponses` (note typo - it's "Reponses" not "Responses" in code)

- 400: Validation errors (includes ZodError)
- 401: Auth failed (empty body)
- 405: Method not allowed
- 500: Unhandled exceptions

Use `sendError({ status, message, data? })` for explicit errors.

## Naming Conventions

- **Variables/Functions**: camelCase (`makeRequestHandler`, `sendOutput`)
- **Types/Interfaces**: PascalCase with `I` prefix for interfaces (`ILogger`, `IMakeRequestHandlerProps`)
- **Generic Types**: `T` prefix (`TInput`, `TOutput`, `TMethod`, `TPath`)
- **Constants**: UPPER_SNAKE_CASE or camelCase for objects
- **Files**: lowercase with test suffix (`server.ts`, `server.test.ts`)

## Essential Commands

```bash
# Development
pnpm install                 # Install all dependencies
pnpm dev                     # Watch-build library + run docs
pnpm build                   # Build all packages
pnpm format                  # Format with Prettier
pnpm lint                    # Lint with ESLint

# Testing
pnpm test                    # Run tests once
pnpm test:watch              # Watch mode
pnpm test:coverage           # Coverage report
pnpm test:ui                 # Visual dashboard

# Release
pnpm changeset               # Create changeset
pnpm release                 # Build + version + publish
```

## Testing Patterns

Handler tests:

```ts
const { handler } = makeRequestHandler({
  /* config */
});
const response = await handler(new Request("http://test.com/path"));
expect(response.status).toBe(200);
expect(await response.json()).toEqual({
  /* expected */
});
```

Logger tests: Mock with `vi.fn()` and verify calls.

## Key Gotchas

1. **Request cloning is mandatory** - don't try to read request body directly multiple times
2. **Input source depends on HTTP method** - GET uses query params, POST uses body (automatic)
3. **Path params override query/body** with same name
4. **Authentication callback returns `false` to deny** (not throw)
5. **Unhandled errors in `run` → 500** with automatic logging
6. **Logger is global** - set once, applies to all handlers
7. **OpenAPI merge is manual** - use reduce pattern above
8. **Malformed JSON in POST/PUT/PATCH → empty object** (v2.4.0+, logged as warning)

## Type Safety Pattern

Generic constraints preserve types end-to-end:

```ts
TInput extends z.AnyZodObject
TOutput extends z.AnyZodObject
TMethod extends HTTPMethod
TPath extends string
```

Client gets full type inference via `typeof clientConfig`.

## Handler Execution Flow

```
Request → Method Check → Auth → Parse Input → Validate → run() → Log → Response
         ↓ 405          ↓ 401   ↓ parse error  ↓ 400    ↓ 500
```

All error responses logged with context (method, path, URL).
