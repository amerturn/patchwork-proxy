import { IncomingMessage, ServerResponse } from 'http';

export interface RequestSizeOptions {
  maxRequestsPerWindow?: number;
  windowMs?: number;
  trackByRoute?: boolean;
}

const sizeStore = new Map<string, { totalBytes: number; count: number }>();

export function getRequestSizeKey(req: IncomingMessage, byRoute: boolean): string {
  if (byRoute) {
    return req.url ?? '/';
  }
  return '__global__';
}

export function recordRequestSize(key: string, bytes: number): void {
  const existing = sizeStore.get(key) ?? { totalBytes: 0, count: 0 };
  sizeStore.set(key, {
    totalBytes: existing.totalBytes + bytes,
    count: existing.count + 1,
  });
}

export function getAverageRequestSize(key: string): number {
  const entry = sizeStore.get(key);
  if (!entry || entry.count === 0) return 0;
  return Math.round(entry.totalBytes / entry.count);
}

export function getTotalRequestSize(key: string): number {
  return sizeStore.get(key)?.totalBytes ?? 0;
}

export function clearRequestSizeStore(): void {
  sizeStore.clear();
}

export function createRequestSizeMiddleware(options: RequestSizeOptions = {}) {
  const { trackByRoute = false } = options;

  return function requestSizeMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void
  ): void {
    let bytes = 0;

    req.on('data', (chunk: Buffer | string) => {
      bytes += Buffer.byteLength(chunk);
    });

    req.on('end', () => {
      const key = getRequestSizeKey(req, trackByRoute);
      recordRequestSize(key, bytes);
      (req as any).requestBytes = bytes;
    });

    next();
  };
}
