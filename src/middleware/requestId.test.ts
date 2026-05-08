import { IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';
import {
  generateRequestId,
  getExistingRequestId,
  attachRequestId,
  createRequestIdMiddleware,
  REQUEST_ID_HEADER,
} from './requestId';

function makeMockReq(headers: Record<string, string> = {}): IncomingMessage {
  const req = new IncomingMessage(new Socket());
  req.headers = { ...headers };
  return req;
}

function makeMockRes(): ServerResponse {
  const req = new IncomingMessage(new Socket());
  const res = new ServerResponse(req);
  const _headers: Record<string, string> = {};
  res.setHeader = (name: string, value: any) => { _headers[name.toLowerCase()] = String(value); return res; };
  res.getHeader = (name: string) => _headers[name.toLowerCase()];
  (res as any)._headers = _headers;
  return res;
}

describe('generateRequestId', () => {
  it('returns a valid UUID v4 string', () => {
    const id = generateRequestId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 50 }, generateRequestId));
    expect(ids.size).toBe(50);
  });
});

describe('getExistingRequestId', () => {
  it('returns the header value when present', () => {
    const req = makeMockReq({ [REQUEST_ID_HEADER]: 'abc-123' });
    expect(getExistingRequestId(req)).toBe('abc-123');
  });

  it('returns undefined when header is absent', () => {
    const req = makeMockReq();
    expect(getExistingRequestId(req)).toBeUndefined();
  });

  it('returns first value when header is an array', () => {
    const req = makeMockReq();
    (req.headers[REQUEST_ID_HEADER] as any) = ['first', 'second'];
    expect(getExistingRequestId(req)).toBe('first');
  });
});

describe('attachRequestId', () => {
  it('sets requestId on req object and header', () => {
    const req = makeMockReq();
    attachRequestId(req, 'test-id');
    expect((req as any).requestId).toBe('test-id');
    expect(req.headers[REQUEST_ID_HEADER]).toBe('test-id');
  });
});

describe('createRequestIdMiddleware', () => {
  it('generates and attaches a new id when no incoming header', () => {
    const req = makeMockReq();
    const res = makeMockRes();
    const next = jest.fn();
    createRequestIdMiddleware()(req, res, next);
    expect((req as any).requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('reuses incoming x-request-id when trustIncoming is true', () => {
    const req = makeMockReq({ [REQUEST_ID_HEADER]: 'existing-id' });
    const res = makeMockRes();
    const next = jest.fn();
    createRequestIdMiddleware({ trustIncoming: true })(req, res, next);
    expect((req as any).requestId).toBe('existing-id');
  });

  it('ignores incoming id when trustIncoming is false', () => {
    const req = makeMockReq({ [REQUEST_ID_HEADER]: 'existing-id' });
    const res = makeMockRes();
    const next = jest.fn();
    createRequestIdMiddleware({ trustIncoming: false })(req, res, next);
    expect((req as any).requestId).not.toBe('existing-id');
  });

  it('sets response header when setResponseHeader is true', () => {
    const req = makeMockReq();
    const res = makeMockRes();
    const next = jest.fn();
    createRequestIdMiddleware({ setResponseHeader: true })(req, res, next);
    expect((res as any)._headers[REQUEST_ID_HEADER]).toBe((req as any).requestId);
  });

  it('does not set response header when setResponseHeader is false', () => {
    const req = makeMockReq();
    const res = makeMockRes();
    const next = jest.fn();
    createRequestIdMiddleware({ setResponseHeader: false })(req, res, next);
    expect((res as any)._headers[REQUEST_ID_HEADER]).toBeUndefined();
  });
});
