import { IncomingMessage, ServerResponse } from 'http';
import {
  getMetric,
  recordMetric,
  getAverageDuration,
  clearMetricsStore,
  getAllMetrics,
  createMetricsMiddleware,
} from './metrics';

function makeMockReq(url: string, method = 'GET'): IncomingMessage {
  return { url, method, headers: {} } as IncomingMessage;
}

function makeMockRes(statusCode = 200): ServerResponse & { _body: string } {
  const listeners: Record<string, (() => void)[]> = {};
  return {
    statusCode,
    _body: '',
    writeHead: jest.fn(),
    end: jest.fn((body: string) => { (res as any)._body = body; }),
    on: jest.fn((event: string, cb: () => void) => { (listeners[event] = listeners[event] || []).push(cb); }),
    emit: jest.fn((event: string) => { (listeners[event] || []).forEach(cb => cb()); }),
  } as unknown as ServerResponse & { _body: string };
}

beforeEach(() => clearMetricsStore());

describe('recordMetric / getMetric', () => {
  it('initialises a metric entry on first record', () => {
    recordMetric('/api/test', 120, false);
    const m = getMetric('/api/test');
    expect(m.hits).toBe(1);
    expect(m.errors).toBe(0);
    expect(m.totalDurationMs).toBe(120);
  });

  it('accumulates multiple hits', () => {
    recordMetric('/api/test', 100, false);
    recordMetric('/api/test', 200, false);
    expect(getMetric('/api/test').hits).toBe(2);
    expect(getMetric('/api/test').totalDurationMs).toBe(300);
  });

  it('counts errors separately', () => {
    recordMetric('/api/err', 50, true);
    recordMetric('/api/err', 60, false);
    expect(getMetric('/api/err').errors).toBe(1);
  });
});

describe('getAverageDuration', () => {
  it('returns 0 when no hits', () => {
    expect(getAverageDuration('/unknown')).toBe(0);
  });

  it('calculates average correctly', () => {
    recordMetric('/avg', 100, false);
    recordMetric('/avg', 200, false);
    expect(getAverageDuration('/avg')).toBe(150);
  });
});

describe('getAllMetrics', () => {
  it('includes avgDurationMs in output', () => {
    recordMetric('/route', 80, false);
    const all = getAllMetrics();
    expect(all['/route'].avgDurationMs).toBe(80);
  });
});

describe('createMetricsMiddleware', () => {
  it('serves JSON on metrics path', () => {
    const middleware = createMetricsMiddleware('/__metrics');
    const req = makeMockReq('/__metrics');
    const res = makeMockRes();
    const next = jest.fn();
    middleware(req, res, next);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({ 'Content-Type': 'application/json' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next and records metric on finish for non-metrics routes', () => {
    const middleware = createMetricsMiddleware();
    const req = makeMockReq('/api/data');
    const res = makeMockRes(200);
    const next = jest.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    (res as any).emit('finish');
    expect(getMetric('/api/data').hits).toBe(1);
  });

  it('marks 5xx responses as errors', () => {
    const middleware = createMetricsMiddleware();
    const req = makeMockReq('/api/fail');
    const res = makeMockRes(500);
    const next = jest.fn();
    middleware(req, res, next);
    (res as any).emit('finish');
    expect(getMetric('/api/fail').errors).toBe(1);
  });
});
