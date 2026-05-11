import { IncomingMessage, ServerResponse } from "http";

export interface BodyLimitOptions {
  maxBytes: number;
  message?: string;
}

export function parseMaxBytes(value: string | number): number {
  if (typeof value === "number") return value;
  const match = value.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i);
  if (!match) throw new Error(`Invalid body limit value: ${value}`);
  const num = parseFloat(match[1]);
  const unit = (match[2] || "b").toLowerCase();
  const units: Record<string, number> = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };
  return Math.floor(num * (units[unit] ?? 1));
}

export function getContentLength(req: IncomingMessage): number | null {
  const header = req.headers["content-length"];
  if (!header) return null;
  const parsed = parseInt(header, 10);
  return isNaN(parsed) ? null : parsed;
}

export function createBodyLimitMiddleware(
  options: BodyLimitOptions
) {
  const { maxBytes, message = "Request body too large" } = options;

  return function bodyLimitMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: (err?: Error) => void
  ): void {
    const contentLength = getContentLength(req);

    if (contentLength !== null && contentLength > maxBytes) {
      res.writeHead(413, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: message, maxBytes }));
      return;
    }

    let received = 0;
    let aborted = false;

    const onData = (chunk: Buffer) => {
      received += chunk.length;
      if (!aborted && received > maxBytes) {
        aborted = true;
        req.removeListener("data", onData);
        req.removeListener("end", onEnd);
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: message, maxBytes }));
      }
    };

    const onEnd = () => {
      req.removeListener("data", onData);
      req.removeListener("end", onEnd);
    };

    req.on("data", onData);
    req.on("end", onEnd);

    next();
  };
}
