import { IncomingMessage, ServerResponse } from 'http';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  successThreshold: number;
  timeout: number; // ms before moving OPEN -> HALF_OPEN
}

export interface CircuitBreakerEntry {
  state: CircuitState;
  failures: number;
  successes: number;
  openedAt: number | null;
}

const store = new Map<string, CircuitBreakerEntry>();

export function getCircuit(key: string): CircuitBreakerEntry {
  if (!store.has(key)) {
    store.set(key, { state: 'CLOSED', failures: 0, successes: 0, openedAt: null });
  }
  return store.get(key)!;
}

export function recordSuccess(key: string, opts: CircuitBreakerOptions): void {
  const c = getCircuit(key);
  if (c.state === 'HALF_OPEN') {
    c.successes += 1;
    if (c.successes >= opts.successThreshold) {
      c.state = 'CLOSED';
      c.failures = 0;
      c.successes = 0;
      c.openedAt = null;
    }
  } else {
    c.failures = 0;
  }
}

export function recordFailure(key: string, opts: CircuitBreakerOptions): void {
  const c = getCircuit(key);
  if (c.state === 'HALF_OPEN') {
    c.state = 'OPEN';
    c.openedAt = Date.now();
    c.successes = 0;
    return;
  }
  c.failures += 1;
  if (c.failures >= opts.failureThreshold) {
    c.state = 'OPEN';
    c.openedAt = Date.now();
  }
}

export function isCircuitOpen(key: string, opts: CircuitBreakerOptions): boolean {
  const c = getCircuit(key);
  if (c.state === 'OPEN') {
    if (c.openedAt !== null && Date.now() - c.openedAt >= opts.timeout) {
      c.state = 'HALF_OPEN';
      c.successes = 0;
      return false;
    }
    return true;
  }
  return false;
}

export function clearCircuitStore(): void {
  store.clear();
}

export function createCircuitBreakerMiddleware(
  opts: Partial<CircuitBreakerOptions> = {}
) {
  const options: CircuitBreakerOptions = {
    failureThreshold: opts.failureThreshold ?? 5,
    successThreshold: opts.successThreshold ?? 2,
    timeout: opts.timeout ?? 30000,
  };

  return function circuitBreakerMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void
  ): void {
    const key = (req as any).routeKey ?? req.url ?? 'default';
    if (isCircuitOpen(key, options)) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Service unavailable (circuit open)' }));
      return;
    }
    next();
  };
}
