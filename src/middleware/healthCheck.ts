import { IncomingMessage, ServerResponse } from 'http';

export interface HealthCheckOptions {
  path?: string;
  includeUptime?: boolean;
  includeMemory?: boolean;
  extraChecks?: Record<string, () => boolean | Promise<boolean>>;
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  uptime?: number;
  memory?: NodeJS.MemoryUsage;
  checks?: Record<string, boolean>;
  timestamp: string;
}

const startTime = Date.now();

export async function runHealthChecks(
  extraChecks: Record<string, () => boolean | Promise<boolean>> = {}
): Promise<{ results: Record<string, boolean>; allPassed: boolean }> {
  const results: Record<string, boolean> = {};
  for (const [name, fn] of Object.entries(extraChecks)) {
    try {
      results[name] = await fn();
    } catch {
      results[name] = false;
    }
  }
  const allPassed = Object.values(results).every(Boolean);
  return { results, allPassed };
}

export function buildHealthPayload(
  options: HealthCheckOptions,
  checkResults: Record<string, boolean>,
  allPassed: boolean
): HealthStatus {
  const payload: HealthStatus = {
    status: allPassed ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
  };
  if (options.includeUptime) {
    payload.uptime = Math.floor((Date.now() - startTime) / 1000);
  }
  if (options.includeMemory) {
    payload.memory = process.memoryUsage();
  }
  if (Object.keys(checkResults).length > 0) {
    payload.checks = checkResults;
  }
  return payload;
}

export function createHealthCheckMiddleware(
  options: HealthCheckOptions = {}
) {
  const healthPath = options.path ?? '/health';

  return async function healthCheckMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void
  ): Promise<void> {
    if (req.url !== healthPath || req.method !== 'GET') {
      return next();
    }

    const { results, allPassed } = await runHealthChecks(options.extraChecks);
    const payload = buildHealthPayload(options, results, allPassed);
    const body = JSON.stringify(payload);
    const statusCode = allPassed ? 200 : 503;

    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-cache, no-store',
    });
    res.end(body);
  };
}
