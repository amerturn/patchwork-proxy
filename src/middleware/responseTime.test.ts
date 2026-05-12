import { IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';
import {
  formatDuration,
  createResponseTimeMiddleware,
} from './responseTime';

function makeMockReq(): IncomingMessage {
  return new IncomingMessage(new Socket());
}

function makeMockRes(): ServerResponse {
  const req = makeMockReq();
  const res = new ServerResponse(req);
  (res as any).headersSent = false;
  const headers: Record<string, string> = {};
  res.setHeader = (name: string, value: any) => { headers[name] = String(value); return res; };
  res.getHeader = (name: string) => headers[name];
  (res as any)._headers = headers;
  return res;
}

describe('formatDuration', () => {
  it('formats with suffix', () => {
    expect(formatDuration(12.3456, 3, true)).toBe('12.346ms');
  });

  it('formats without suffix', () => {
    expect(formatDuration(12.3456, 3, false)).toBe('12.346');
  });

  it('respects digits option', () => {
    expect(formatDuration(5.0, 0, false)).toBe('5');
  });
});

describe('createResponseTimeMiddleware', () => {
  it('sets default X-Response-Time header on finish', (done) => {
    const req = makeMockReq();
    const res = makeMockRes();
    const middleware = createResponseTimeMiddleware();

    middleware(req, res, () => {
      res.emit('finish');
      const value = res.getHeader('X-Response-Time') as string;
      expect(value).toMatch(/^\d+\.\d{3}ms$/);
      done();
    });
  });

  it('uses custom header name', (done) => {
    const req = makeMockReq();
    const res = makeMockRes();
    const middleware = createResponseTimeMiddleware({ header: 'X-Time' });

    middleware(req, res, () => {
      res.emit('finish');
      const value = res.getHeader('X-Time') as string;
      expect(value).toBeDefined();
      done();
    });
  });

  it('omits suffix when suffix is false', (done) => {
    const req = makeMockReq();
    const res = makeMockRes();
    const middleware = createResponseTimeMiddleware({ suffix: false, digits: 2 });

    middleware(req, res, () => {
      res.emit('finish');
      const value = res.getHeader('X-Response-Time') as string;
      expect(value).not.toContain('ms');
      expect(value).toMatch(/^\d+\.\d{2}$/);
      done();
    });
  });

  it('does not set header if already sent', (done) => {
    const req = makeMockReq();
    const res = makeMockRes();
    (res as any).headersSent = true;
    const middleware = createResponseTimeMiddleware();

    middleware(req, res, () => {
      res.emit('finish');
      expect(res.getHeader('X-Response-Time')).toBeUndefined();
      done();
    });
  });
});
