import { IncomingMessage, ServerResponse } from 'http';

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
}

interface ClientRecord {
  count: number;
  resetAt: number;
}

const store = new Map<string, ClientRecord>();

export function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

export function checkRateLimit(
  clientIp: string,
  options: RateLimitOptions
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let record = store.get(clientIp);

  if (!record || now >= record.resetAt) {
    record = { count: 0, resetAt: now + options.windowMs };
    store.set(clientIp, record);
  }

  record.count += 1;
  const allowed = record.count <= options.maxRequests;
  const remaining = Math.max(0, options.maxRequests - record.count);

  return { allowed, remaining, resetAt: record.resetAt };
}

export function createRateLimitMiddleware(options: RateLimitOptions) {
  return function rateLimitMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void
  ): void {
    const clientIp = getClientIp(req);
    const { allowed, remaining, resetAt } = checkRateLimit(clientIp, options);

    res.setHeader('X-RateLimit-Limit', options.maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(resetAt / 1000));

    if (!allowed) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Too Many Requests' }));
      return;
    }

    next();
  };
}

export function clearRateLimitStore(): void {
  store.clear();
}
