import { IncomingMessage, ServerResponse } from 'http';
import {
  getCacheKey,
  getFromCache,
  setInCache,
  clearCacheStore,
  createCacheMiddleware,
} from './cache';

function makeMockReq(method = 'GET', url = '/test'): IncomingMessage {
  return { method, url } as IncomingMessage;
}

function makeMockRes(): ServerResponse & { _body: string; _headers: Record<string, any> } {
  const headers: Record<string, any> = {};
  const res = {
    statusCode: 200,
    _body: '',
    _headers: headers,
    write: jest.fn(),
    end: jest.fn(),
    writeHead: jest.fn(),
    setHeader: jest.fn((k: string, v: any) => { headers[k] = v; }),
    getHeaders: jest.fn(() => headers),
  } as any;
  return res;
}

beforeEach(() => clearCacheStore());

describe('getCacheKey', () => {
  it('combines method and url', () => {
    const req = makeMockReq('GET', '/foo');
    expect(getCacheKey(req)).toBe('GET:/foo');
  });
});

describe('getFromCache / setInCache', () => {
  it('returns null for missing key', () => {
    expect(getFromCache('missing')).toBeNull();
  });

  it('stores and retrieves an entry', () => {
    const entry = { body: Buffer.from('ok'), statusCode: 200, headers: {}, expiresAt: Date.now() + 10000 };
    setInCache('key1', entry, 100);
    expect(getFromCache('key1')).toEqual(entry);
  });

  it('returns null for expired entry', () => {
    const entry = { body: Buffer.from('old'), statusCode: 200, headers: {}, expiresAt: Date.now() - 1 };
    setInCache('key2', entry, 100);
    expect(getFromCache('key2')).toBeNull();
  });

  it('evicts oldest entry when maxSize exceeded', () => {
    const entry = (n: number) => ({ body: Buffer.from(`${n}`), statusCode: 200, headers: {}, expiresAt: Date.now() + 10000 });
    setInCache('a', entry(1), 2);
    setInCache('b', entry(2), 2);
    setInCache('c', entry(3), 2);
    expect(getFromCache('a')).toBeNull();
    expect(getFromCache('b')).not.toBeNull();
  });
});

describe('createCacheMiddleware', () => {
  it('calls next for non-cacheable methods', () => {
    const middleware = createCacheMiddleware();
    const req = makeMockReq('POST', '/data');
    const res = makeMockRes();
    const next = jest.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('sets x-cache MISS header and calls next on cache miss', () => {
    const middleware = createCacheMiddleware();
    const req = makeMockReq('GET', '/hello');
    const res = makeMockRes();
    const next = jest.fn();
    middleware(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith('x-cache', 'MISS');
    expect(next).toHaveBeenCalled();
  });

  it('serves from cache on second request', () => {
    const middleware = createCacheMiddleware({ ttlSeconds: 10 });
    const req = makeMockReq('GET', '/cached');
    const res1 = makeMockRes();
    const next = jest.fn();
    middleware(req, res1, next);
    const body = Buffer.from('hello');
    res1.statusCode = 200;
    (res1.end as jest.Mock).mock.calls;
    // Manually populate cache
    const { setInCache: set } = require('./cache');
    set('GET:/cached', { body, statusCode: 200, headers: {}, expiresAt: Date.now() + 10000 }, 500);
    const res2 = makeMockRes();
    middleware(req, res2, jest.fn());
    expect(res2.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({ 'x-cache': 'HIT' }));
    expect(res2.end).toHaveBeenCalledWith(body);
  });
});
