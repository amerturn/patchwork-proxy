import { IncomingMessage, ServerResponse } from 'http';

export interface RouteMetric {
  hits: number;
  errors: number;
  totalDurationMs: number;
  lastAccessedAt: number;
}

const metricsStore = new Map<string, RouteMetric>();

export function getMetric(route: string): RouteMetric {
  if (!metricsStore.has(route)) {
    metricsStore.set(route, { hits: 0, errors: 0, totalDurationMs: 0, lastAccessedAt: 0 });
  }
  return metricsStore.get(route)!;
}

export function recordMetric(route: string, durationMs: number, isError: boolean): void {
  const metric = getMetric(route);
  metric.hits += 1;
  metric.totalDurationMs += durationMs;
  metric.lastAccessedAt = Date.now();
  if (isError) metric.errors += 1;
}

export function getAverageDuration(route: string): number {
  const metric = getMetric(route);
  return metric.hits === 0 ? 0 : metric.totalDurationMs / metric.hits;
}

export function clearMetricsStore(): void {
  metricsStore.clear();
}

export function getAllMetrics(): Record<string, RouteMetric & { avgDurationMs: number }> {
  const result: Record<string, RouteMetric & { avgDurationMs: number }> = {};
  for (const [route, metric] of metricsStore.entries()) {
    result[route] = { ...metric, avgDurationMs: getAverageDuration(route) };
  }
  return result;
}

export function createMetricsMiddleware(
  metricsPath = '/__metrics'
) {
  return function metricsMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void
  ): void {
    if (req.url === metricsPath && req.method === 'GET') {
      const payload = JSON.stringify(getAllMetrics(), null, 2);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
      res.end(payload);
      return;
    }

    const route = req.url?.split('?')[0] ?? '/';
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const isError = res.statusCode >= 500;
      recordMetric(route, duration, isError);
    });

    next();
  };
}
