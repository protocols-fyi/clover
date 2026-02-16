---
"@protocols-fyi/clover": minor
---

Export reusable types for building authentication wrappers

Adds three new exported types that can be used outside the codebase:

- `RunCallbackProps<TInput, TOutput, TAuthContext>` - The complete parameter object passed to the run callback
- `SendOutputFn<TOutput>` - Function type for sending successful responses
- `SendErrorFn` - Function type for sending error responses

**Example usage:**

```typescript
import type { RunCallbackProps } from '@protocols-fyi/clover';

// Extend with custom fields
type CustomRunProps<TInput, TOutput> = RunCallbackProps<TInput, TOutput, void> & {
  requestId: string;
  database: DatabaseClient;
};
```

This change is fully backward compatible.
