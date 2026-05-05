# patchwork-proxy

> Lightweight reverse proxy with declarative route patching and header rewriting via YAML config

---

## Installation

```bash
npm install -g patchwork-proxy
```

---

## Usage

Create a `patchwork.yaml` config file:

```yaml
port: 8080
routes:
  - match: /api/v1
    target: http://localhost:3000
    rewrite:
      path: /v1
    headers:
      set:
        X-Forwarded-By: patchwork
        Authorization: Bearer ${TOKEN}
      remove:
        - X-Internal-Key

  - match: /static
    target: http://cdn.example.com
```

Then start the proxy:

```bash
patchwork-proxy --config patchwork.yaml
```

Or run programmatically:

```ts
import { createProxy } from "patchwork-proxy";

const proxy = createProxy({ config: "./patchwork.yaml" });
proxy.listen(8080, () => console.log("Proxy running on :8080"));
```

---

## Configuration Reference

| Field            | Type     | Description                          |
|------------------|----------|--------------------------------------|
| `port`           | `number` | Port the proxy listens on            |
| `routes[].match` | `string` | URL path prefix to match             |
| `routes[].target`| `string` | Upstream target URL                  |
| `headers.set`    | `object` | Headers to add or override           |
| `headers.remove` | `array`  | Headers to strip from the request    |

---

## License

[MIT](./LICENSE)