import { IncomingMessage, ServerResponse } from 'http';
import {
  checkRateLimit,
  clearRateLimitStore,
  createRateLimitMiddleware,
  getClientIp,
} from './rateLimit';

function makeMockReq(ip?: string, forwarded?: string): Partial<IncomingMessage> {
  return {
    headers: forwarded ? { 'x-forwarded-for': forwarded } : {},
    socket: { remoteAddress: ip ?? '127.0.0.1' } as any,
  };
}

function makeMockRes(): { res: Partial<ServerResponse>; headers: Record<string, any>; statusCode: number; body: string } {
  const headers: Record<string, any> = {};
  let statusCode = 200;
  let body = '';
  const res: Partial<ServerResponse> = {
    setHeader: (k: string, v: any) => { headers[k] = v; },
    writeHead: (code: number) => { statusCode = code; },
    end: (data?: any) => { body = data ?? ''; },
  } as any;
  return { res, headers, get statusCode() { return statusCode; }, get body() { return body; } };
}

beforeEach(() => clearRateLimitStore());

describe('getClientIp', () => {
  it('returns x-forwarded-for first IP', () => {
    const req = makeMockReq('10.0.0.1', '192.168.1.1, 10.0.0.1');
    expect(getClientIp(req as IncomingMessage)).toBe('192.168.1.1');
  });

  it('falls back to socket remoteAddress', () => {
    const req = makeMockReq('10.0.0.2');
    expect(getClientIp(req as IncomingMessage)).toBe('10.0.0.2');
  });
});

describe('checkRateLimit', () => {
  it('allows requests within limit', () => {
    const result = checkRateLimit('1.2.3.4', { windowMs: 60000, maxRequests: 5 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('blocks requests exceeding limit', () => {
    const opts = { windowMs: 60000, maxRequests: 2 };
    checkRateLimit('1.2.3.5', opts);
    checkRateLimit('1.2.3.5', opts);
    const result = checkRateLimit('1.2.3.5', opts);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});

describe('createRateLimitMiddleware', () => {
  it('sets rate limit headers and calls next when allowed', () => {
    const middleware = createRateLimitMiddleware({ windowMs: 60000, maxRequests: 10 });
    const req = makeMockReq('5.5.5.5');
    const { res, headers } = makeMockRes();
    const next = jest.fn();
    middleware(req as IncomingMessage, res as ServerResponse, next);
    expect(next).toHaveBeenCalled();
    expect(headers['X-RateLimit-Limit']).toBe(10);
    expect(headers['X-RateLimit-Remaining']).toBe(9);
  });

  it('returns 429 when rate limit exceeded', () => {
    const middleware = createRateLimitMiddleware({ windowMs: 60000, maxRequests: 1 });
    const req = makeMockReq('6.6.6.6');
    const mock1 = makeMockRes();
    const mock2 = makeMockRes();
    const next = jest.fn();
    middleware(req as IncomingMessage, mock1.res as ServerResponse, next);
    middleware(req as IncomingMessage, mock2.res as ServerResponse, next);
    expect(mock2.statusCode).toBe(429);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
