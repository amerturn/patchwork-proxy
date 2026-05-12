# responseTime Middleware

Adds an `X-Response-Time` header (or custom header) to every response, reporting how long the server took to process the request in milliseconds.

## Usage

```ts
import { createResponseTimeMiddleware } from './middleware/responseTime';

const responseTime = createResponseTimeMiddleware({
  header: 'X-Response-Time', // default
  digits: 3,                 // decimal places, default 3
  suffix: true,              // append 'ms' unit, default true
});
```

## Options

| Option   | Type      | Default              | Description                              |
|----------|-----------|----------------------|------------------------------------------|
| `header` | `string`  | `X-Response-Time`    | Name of the response header to set       |
| `digits` | `number`  | `3`                  | Number of decimal places in the value    |
| `suffix` | `boolean` | `true`               | Whether to append `ms` to the value      |

## Example Output

```
X-Response-Time: 12.453ms
```

## Notes

- Timing starts as soon as the middleware is invoked, using `process.hrtime()` for high-resolution measurement.
- The header is written on the `finish` event of the response.
- If `res.headersSent` is already `true` when the response finishes, the header is skipped to avoid errors.
