---
"@protocols-fyi/clover": minor
---

Add optional `options` parameter to `sendError` function

The `sendError` helper now accepts an optional second parameter for response options, allowing users to customize headers, statusText, and other response properties.

**New signature:**
```typescript
sendError: (
  { status, message, data }: { status: number } & ErrorResponse,
  options?: Partial<Omit<ResponseInit, "status">>
) => Promise<Response>
```

**Example usage:**
```typescript
// With custom headers
return sendError(
  {
    status: 503,
    message: 'Service unavailable',
    data: { retry_after_seconds: 30 },
  },
  {
    headers: { 'Retry-After': '30' },
  }
);

// With statusText
return sendError(
  {
    status: 429,
    message: 'Too many requests',
  },
  {
    statusText: 'Rate Limited',
  }
);
```

This change is fully backward compatible - existing code continues to work without modifications.
