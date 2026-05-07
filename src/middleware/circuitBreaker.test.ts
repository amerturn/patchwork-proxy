import {
  getCircuit,
  recordSuccess,
  recordFailure,
  isCircuitOpen,
  clearCircuitStore,
  createCircuitBreakerMiddleware,
  CircuitBreakerOptions,
} from './circuitBreaker';
import { IncomingMessage, ServerResponse } from 'http';

const opts: CircuitBreakerOptions = { failureThreshold: 3, successThreshold: 2, timeout: 1000 };

function makeMockReq(url = '/'): Partial<IncomingMessage> {
  return { url, headers: {} };
}

function makeMockRes(): { writeHead: jest.Mock; end: jest.Mock; statusCode: number } {
  return { writeHead: jest.fn(), end: jest.fn(), statusCode: 200 };
}

beforeEach(() => clearCircuitStore());

describe('getCircuit', () => {
  it('returns a CLOSED circuit by default', () => {
    expect(getCircuit('svc').state).toBe('CLOSED');
  });
});

describe('recordFailure / isCircuitOpen', () => {
  it('opens after reaching failure threshold', () => {
    recordFailure('svc', opts);
    recordFailure('svc', opts);
    recordFailure('svc', opts);
    expect(getCircuit('svc').state).toBe('OPEN');
    expect(isCircuitOpen('svc', opts)).toBe(true);
  });

  it('transitions to HALF_OPEN after timeout', async () => {
    recordFailure('svc', { ...opts, timeout: 10 });
    recordFailure('svc', { ...opts, timeout: 10 });
    recordFailure('svc', { ...opts, timeout: 10 });
    await new Promise((r) => setTimeout(r, 20));
    expect(isCircuitOpen('svc', { ...opts, timeout: 10 })).toBe(false);
    expect(getCircuit('svc').state).toBe('HALF_OPEN');
  });
});

describe('recordSuccess', () => {
  it('closes circuit after enough successes in HALF_OPEN', () => {
    recordFailure('svc', opts);
    recordFailure('svc', opts);
    recordFailure('svc', opts);
    getCircuit('svc').state = 'HALF_OPEN';
    recordSuccess('svc', opts);
    recordSuccess('svc', opts);
    expect(getCircuit('svc').state).toBe('CLOSED');
  });
});

describe('createCircuitBreakerMiddleware', () => {
  it('calls next when circuit is closed', () => {
    const mw = createCircuitBreakerMiddleware(opts);
    const req = makeMockReq('/api') as any;
    req.routeKey = 'svc2';
    const res = makeMockRes() as any;
    const next = jest.fn();
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 503 when circuit is open', () => {
    const mw = createCircuitBreakerMiddleware(opts);
    const req = makeMockReq('/api') as any;
    req.routeKey = 'svc3';
    recordFailure('svc3', opts);
    recordFailure('svc3', opts);
    recordFailure('svc3', opts);
    const res = makeMockRes() as any;
    const next = jest.fn();
    mw(req, res, next);
    expect(res.writeHead).toHaveBeenCalledWith(503, expect.any(Object));
    expect(next).not.toHaveBeenCalled();
  });
});
