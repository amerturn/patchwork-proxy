import { IncomingMessage, ServerResponse } from 'http';

export interface CacheEntry {
  body: Buffer;
  statusCode: number;
  headers: Record<string, string | string[]>;
  expiresAt: number;
}

export interface CacheOptions {
  ttlSeconds: number;
  maxSize: number;
  cacheableMethods?: string[];
  cacheableStatuses?: number[];
}

const DEFAULT_OPTIONS: Required<CacheOptions> = {
  ttlSeconds: 60,
  maxSize: 500,
  cacheableMethods: ['GET', 'HEAD'],
  cacheableStatuses: [200, 203, 204, 301, 404],
};

const store = new Map<string, CacheEntry>();

export function getCacheKey(req: IncomingMessage): string {
  return `${req.method}:${req.url}`;
}

export function getFromCache(key: string): CacheEntry | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry;
}

export function setInCache(key: string, entry: CacheEntry, maxSize: number): void {
  if (store.size >= maxSize) {
    const firstKey = store.keys().next().value;
    if (firstKey !== undefined) store.delete(firstKey);
  }
  store.set(key, entry);
}

export function clearCacheStore(): void {
  store.clear();
}

export function createCacheMiddleware(options: Partial<CacheOptions> = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return function cacheMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void
  ): void {
    if (!opts.cacheableMethods.includes(req.method ?? '')) {
      return next();
    }

    const key = getCacheKey(req);
    const cached = getFromCache(key);

    if (cached) {
      res.writeHead(cached.statusCode, { ...cached.headers, 'x-cache': 'HIT' });
      res.end(cached.body);
      return;
    }

    const chunks: Buffer[] = [];
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);

    res.write = (chunk: any, ...args: any[]): boolean => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return (originalWrite as any)(chunk, ...args);
    };

    res.end = (chunk?: any, ...args: any[]): ServerResponse => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      if (opts.cacheableStatuses.includes(res.statusCode)) {
        setInCache(key, {
          body: Buffer.concat(chunks),
          statusCode: res.statusCode,
          headers: res.getHeaders() as Record<string, string | string[]>,
          expiresAt: Date.now() + opts.ttlSeconds * 1000,
        }, opts.maxSize);
      }
      return (originalEnd as any)(chunk, ...args);
    };

    res.setHeader('x-cache', 'MISS');
    next();
  };
}
