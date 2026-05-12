# requestSize Middleware

Tracks the byte size of incoming request bodies, either globally or per-route.

## Usage

```typescript
import { createRequestSizeMiddleware, getAverageRequestSize, getTotalRequestSize } from './requestSize';

// Track globally
const middleware = createRequestSizeMiddleware();

// Track per route
const middleware = createRequestSizeMiddleware({ trackByRoute: true });
```

## Config (YAML)

```yaml
requestSize:
  trackByRoute: true
```

## API

| Function | Description |
|---|---|
| `createRequestSizeMiddleware(options?)` | Returns middleware that tracks request body sizes |
| `getAverageRequestSize(key)` | Returns average byte size for a given key |
| `getTotalRequestSize(key)` | Returns total bytes recorded for a given key |
| `recordRequestSize(key, bytes)` | Manually record a size entry |
| `clearRequestSizeStore()` | Reset all stored size data (useful in tests) |

## Notes

- When `trackByRoute` is `false` (default), all requests are tracked under the `__global__` key.
- When `trackByRoute` is `true`, each unique URL path is tracked separately.
- The raw byte count for each request is also attached to `req.requestBytes` for downstream use.
