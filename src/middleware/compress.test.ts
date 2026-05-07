import { IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';
import {
  selectEncoding,
  shouldCompress,
  createCompressMiddleware,
} from './compress';

function makeMockReq(headers: Record<string, string> = {}): IncomingMessage {
  const req = new IncomingMessage(new Socket());
  Object.assign(req.headers, headers);
  return req;
}

function makeMockRes(): ServerResponse {
  const req = new IncomingMessage(new Socket());
  const res = new ServerResponse(req);
  const written: Buffer[] = [];
  (res as any)._written = written;
  res.write = (chunk: unknown) => {
    written.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
    return true;
  };
  res.end = (chunk?: unknown) => {
    if (chunk) written.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
    return res;
  };
  return res;
}

describe('selectEncoding', () => {
  it('returns gzip when accepted', () => {
    expect(selectEncoding('gzip, deflate', ['gzip', 'deflate'])).toBe('gzip');
  });

  it('returns deflate when gzip not accepted', () => {
    expect(selectEncoding('deflate', ['gzip', 'deflate'])).toBe('deflate');
  });

  it('returns identity when no match', () => {
    expect(selectEncoding('br', ['gzip', 'deflate'])).toBe('identity');
  });

  it('returns identity when accept-encoding is undefined', () => {
    expect(selectEncoding(undefined, ['gzip'])).toBe('identity');
  });
});

describe('shouldCompress', () => {
  it('returns true for compressible content above threshold', () => {
    const res = makeMockRes();
    res.setHeader('content-type', 'application/json');
    expect(shouldCompress(res, 2048, 1024)).toBe(true);
  });

  it('returns false below threshold', () => {
    const res = makeMockRes();
    res.setHeader('content-type', 'text/plain');
    expect(shouldCompress(res, 100, 1024)).toBe(false);
  });

  it('returns false for non-compressible content type', () => {
    const res = makeMockRes();
    res.setHeader('content-type', 'image/png');
    expect(shouldCompress(res, 5000, 1024)).toBe(false);
  });

  it('returns false when no content-type header', () => {
    const res = makeMockRes();
    expect(shouldCompress(res, 5000, 1024)).toBe(false);
  });
});

describe('createCompressMiddleware', () => {
  it('calls next without compression when encoding is identity', () => {
    const middleware = createCompressMiddleware();
    const req = makeMockReq({});
    const res = makeMockRes();
    const next = jest.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('calls next when accept-encoding is gzip', () => {
    const middleware = createCompressMiddleware();
    const req = makeMockReq({ 'accept-encoding': 'gzip' });
    const res = makeMockRes();
    const next = jest.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('skips compression for non-compressible content type on end', () => {
    const middleware = createCompressMiddleware({ threshold: 0 });
    const req = makeMockReq({ 'accept-encoding': 'gzip' });
    const res = makeMockRes();
    const next = jest.fn();
    middleware(req, res, next);
    res.setHeader('content-type', 'image/png');
    res.end('binary data');
    expect(res.getHeader('Content-Encoding')).toBeUndefined();
  });
});
