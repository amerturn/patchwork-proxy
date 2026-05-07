import { IncomingMessage, ServerResponse } from 'http';
import { isOriginAllowed, applyCorsHeaders, createCorsMiddleware } from './cors';

function makeMockReq(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  return {
    method: 'GET',
    headers: {},
    ...overrides,
  } as IncomingMessage;
}

function makeMockRes(): ServerResponse & { _headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  return {
    _headers: headers,
    setHeader(name: string, value: string) { headers[name.toLowerCase()] = value; },
    getHeader(name: string) { return headers[name.toLowerCase()]; },
    writeHead: jest.fn(),
    end: jest.fn(),
  } as unknown as ServerResponse & { _headers: Record<string, string> };
}

describe('isOriginAllowed', () => {
  it('allows wildcard', () => {
    expect(isOriginAllowed('https://example.com', '*')).toBe(true);
  });

  it('allows exact match in array', () => {
    expect(isOriginAllowed('https://a.com', ['https://a.com', 'https://b.com'])).toBe(true);
  });

  it('rejects non-matching origin', () => {
    expect(isOriginAllowed('https://evil.com', ['https://a.com'])).toBe(false);
  });

  it('allows wildcard inside array', () => {
    expect(isOriginAllowed('https://any.com', ['*'])).toBe(true);
  });
});

describe('applyCorsHeaders', () => {
  it('sets Allow-Origin for matching origin', () => {
    const req = makeMockReq({ headers: { origin: 'https://a.com' } });
    const res = makeMockRes();
    applyCorsHeaders(req, res, { origins: ['https://a.com'] });
    expect(res._headers['access-control-allow-origin']).toBe('https://a.com');
  });

  it('sets wildcard when origins is *', () => {
    const req = makeMockReq({ headers: {} });
    const res = makeMockRes();
    applyCorsHeaders(req, res, { origins: '*' });
    expect(res._headers['access-control-allow-origin']).toBe('*');
  });

  it('sets credentials header when enabled', () => {
    const req = makeMockReq({ headers: { origin: 'https://a.com' } });
    const res = makeMockRes();
    applyCorsHeaders(req, res, { origins: '*', credentials: true });
    expect(res._headers['access-control-allow-credentials']).toBe('true');
  });

  it('sets max-age when provided', () => {
    const req = makeMockReq({ headers: {} });
    const res = makeMockRes();
    applyCorsHeaders(req, res, { origins: '*', maxAge: 3600 });
    expect(res._headers['access-control-max-age']).toBe('3600');
  });
});

describe('createCorsMiddleware', () => {
  it('calls next for non-OPTIONS requests', () => {
    const req = makeMockReq({ method: 'GET', headers: { origin: 'https://a.com' } });
    const res = makeMockRes();
    const next = jest.fn();
    createCorsMiddleware({ origins: '*' })(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('responds 204 and does not call next for OPTIONS preflight', () => {
    const req = makeMockReq({ method: 'OPTIONS', headers: { origin: 'https://a.com' } });
    const res = makeMockRes();
    const next = jest.fn();
    createCorsMiddleware({ origins: '*' })(req, res, next);
    expect(res.writeHead).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
