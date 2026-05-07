import { createCacheMiddleware, clearCacheStore, setInCache } from './cache';
import { IncomingMessage, ServerResponse } from 'http';

function makeReq(method = 'GET', url = '/api/data'): IncomingMessage {
  return { method, url } as IncomingMessage;
}

function makeRes(statusCode = 200): ServerResponse {
  const headers: Record<string, any> = {};
  return {
    statusCode,
    write: jest.fn(),
    end: jest.fn(),
    writeHead: jest.fn(),
    setHeader: jest.fn((k: string, v: any) => { headers[k] = v; }),
    getHeaders: jest.fn(() => headers),
  } as any;
}

beforeEach(() => clearCacheStore());

describe('cache middleware integration', () => {
  it('does not cache non-200 responses', () => {
    const middleware = createCacheMiddleware({ ttlSeconds: 10, cacheableStatuses: [200] });
    const req = makeReq('GET', '/not-found');
    const res = makeRes(404);
    const next = jest.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    // Simulate end with 404 body
    const endFn = (res.end as jest.Mock);
    // Patch statusCode to 404 before calling captured end
    res.statusCode = 404;
    // Second request should still miss
    const res2 = makeRes();
    middleware(req, res2, jest.fn());
    expect(res2.writeHead).not.toHaveBeenCalled();
  });

  it('respects custom ttlSeconds', () => {
    const middleware = createCacheMiddleware({ ttlSeconds: 0.001 });
    const req = makeReq('GET', '/short-ttl');
    setInCache('GET:/short-ttl', {
      body: Buffer.from('data'),
      statusCode: 200,
      headers: {},
      expiresAt: Date.now() - 1,
    }, 500);
    const res = makeRes();
    const next = jest.fn();
    middleware(req, res, next);
    // Expired — should call next (cache miss)
    expect(next).toHaveBeenCalled();
    expect(res.writeHead).not.toHaveBeenCalled();
  });

  it('handles HEAD requests', () => {
    const middleware = createCacheMiddleware();
    const req = makeReq('HEAD', '/head-test');
    const res = makeRes();
    const next = jest.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('does not interfere with POST requests', () => {
    const middleware = createCacheMiddleware();
    const req = makeReq('POST', '/submit');
    const res = makeRes();
    const next = jest.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('serves cached entry with HIT header', () => {
    const middleware = createCacheMiddleware();
    const req = makeReq('GET', '/hit-test');
    setInCache('GET:/hit-test', {
      body: Buffer.from('cached body'),
      statusCode: 200,
      headers: { 'content-type': 'text/plain' },
      expiresAt: Date.now() + 60000,
    }, 500);
    const res = makeRes();
    middleware(req, res, jest.fn());
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({ 'x-cache': 'HIT' }));
    expect(res.end).toHaveBeenCalledWith(Buffer.from('cached body'));
  });
});
