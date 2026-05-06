import { IncomingMessage, ServerResponse } from 'http';
import {
  extractBearerToken,
  extractApiKey,
  extractBasicCredentials,
  checkAuth,
  createAuthMiddleware,
} from './auth';

function makeMockReq(headers: Record<string, string>): IncomingMessage {
  return { headers } as unknown as IncomingMessage;
}

function makeMockRes(): { statusCode: number; headers: Record<string, string>; body: string; writeHead: jest.Mock; end: jest.Mock } {
  const res = { statusCode: 200, headers: {} as Record<string, string>, body: '' } as any;
  res.writeHead = jest.fn((code: number, hdrs: Record<string, string>) => { res.statusCode = code; res.headers = { ...res.headers, ...hdrs }; });
  res.end = jest.fn((b: string) => { res.body = b; });
  return res;
}

describe('extractBearerToken', () => {
  it('returns token from valid Authorization header', () => {
    const req = makeMockReq({ authorization: 'Bearer mytoken123' });
    expect(extractBearerToken(req)).toBe('mytoken123');
  });

  it('returns null when header is missing', () => {
    expect(extractBearerToken(makeMockReq({}))).toBeNull();
  });

  it('returns null for non-Bearer scheme', () => {
    expect(extractBearerToken(makeMockReq({ authorization: 'Basic abc' }))).toBeNull();
  });
});

describe('extractApiKey', () => {
  it('returns key from default header', () => {
    const req = makeMockReq({ 'x-api-key': 'secret' });
    expect(extractApiKey(req)).toBe('secret');
  });

  it('returns key from custom header', () => {
    const req = makeMockReq({ 'x-custom-key': 'abc' });
    expect(extractApiKey(req, 'x-custom-key')).toBe('abc');
  });

  it('returns null if header absent', () => {
    expect(extractApiKey(makeMockReq({}))).toBeNull();
  });
});

describe('extractBasicCredentials', () => {
  it('decodes valid Basic credentials', () => {
    const encoded = Buffer.from('admin:password').toString('base64');
    const req = makeMockReq({ authorization: `Basic ${encoded}` });
    expect(extractBasicCredentials(req)).toEqual({ user: 'admin', pass: 'password' });
  });

  it('returns null when header missing', () => {
    expect(extractBasicCredentials(makeMockReq({}))).toBeNull();
  });
});

describe('checkAuth', () => {
  it('validates bearer token', () => {
    const req = makeMockReq({ authorization: 'Bearer tok1' });
    expect(checkAuth(req, { type: 'bearer', tokens: ['tok1', 'tok2'] })).toBe(true);
    expect(checkAuth(req, { type: 'bearer', tokens: ['other'] })).toBe(false);
  });

  it('validates basic credentials', () => {
    const encoded = Buffer.from('user:pass').toString('base64');
    const req = makeMockReq({ authorization: `Basic ${encoded}` });
    expect(checkAuth(req, { type: 'basic', users: { user: 'pass' } })).toBe(true);
    expect(checkAuth(req, { type: 'basic', users: { user: 'wrong' } })).toBe(false);
  });
});

describe('createAuthMiddleware', () => {
  it('calls next on valid auth', () => {
    const req = makeMockReq({ authorization: 'Bearer valid' });
    const res = makeMockRes();
    const next = jest.fn();
    createAuthMiddleware({ type: 'bearer', tokens: ['valid'] })(req as any, res as any, next);
    expect(next).toHaveBeenCalled();
    expect(res.writeHead).not.toHaveBeenCalled();
  });

  it('returns 401 on invalid auth', () => {
    const req = makeMockReq({});
    const res = makeMockRes();
    const next = jest.fn();
    createAuthMiddleware({ type: 'bearer', tokens: ['valid'] })(req as any, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});
