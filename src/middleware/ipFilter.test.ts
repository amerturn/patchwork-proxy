import { IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';
import {
  getClientIp,
  ipMatchesCidr,
  isIpAllowed,
  createIpFilterMiddleware,
} from './ipFilter';

function makeMockReq(ip?: string, forwarded?: string): IncomingMessage {
  const req = new IncomingMessage(new Socket());
  if (forwarded) req.headers['x-forwarded-for'] = forwarded;
  if (ip) (req.socket as any).remoteAddress = ip;
  return req;
}

function makeMockRes(): { res: ServerResponse; statusCode: () => number; body: () => string } {
  let code = 200;
  let body = '';
  const res = {
    writeHead: (c: number) => { code = c; },
    end: (b: string) => { body = b; },
  } as unknown as ServerResponse;
  return { res, statusCode: () => code, body: () => body };
}

describe('getClientIp', () => {
  it('returns x-forwarded-for when present', () => {
    const req = makeMockReq(undefined, '203.0.113.5, 10.0.0.1');
    expect(getClientIp(req)).toBe('203.0.113.5');
  });

  it('falls back to socket remoteAddress', () => {
    const req = makeMockReq('192.168.1.1');
    expect(getClientIp(req)).toBe('192.168.1.1');
  });
});

describe('ipMatchesCidr', () => {
  it('matches exact IP', () => {
    expect(ipMatchesCidr('10.0.0.1', '10.0.0.1')).toBe(true);
    expect(ipMatchesCidr('10.0.0.2', '10.0.0.1')).toBe(false);
  });

  it('matches CIDR range', () => {
    expect(ipMatchesCidr('192.168.1.50', '192.168.1.0/24')).toBe(true);
    expect(ipMatchesCidr('192.168.2.1', '192.168.1.0/24')).toBe(false);
  });

  it('handles /32 as exact match', () => {
    expect(ipMatchesCidr('10.0.0.5', '10.0.0.5/32')).toBe(true);
    expect(ipMatchesCidr('10.0.0.6', '10.0.0.5/32')).toBe(false);
  });
});

describe('isIpAllowed', () => {
  it('allows IPs in allowlist', () => {
    expect(isIpAllowed('10.0.0.1', { mode: 'allowlist', ips: ['10.0.0.0/8'] })).toBe(true);
    expect(isIpAllowed('8.8.8.8', { mode: 'allowlist', ips: ['10.0.0.0/8'] })).toBe(false);
  });

  it('blocks IPs in denylist', () => {
    expect(isIpAllowed('10.0.0.1', { mode: 'denylist', ips: ['10.0.0.0/8'] })).toBe(false);
    expect(isIpAllowed('8.8.8.8', { mode: 'denylist', ips: ['10.0.0.0/8'] })).toBe(true);
  });
});

describe('createIpFilterMiddleware', () => {
  it('calls next for allowed IP', () => {
    const middleware = createIpFilterMiddleware({ mode: 'allowlist', ips: ['127.0.0.1'] });
    const req = makeMockReq('127.0.0.1');
    const { res } = makeMockRes();
    const next = jest.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 for blocked IP', () => {
    const middleware = createIpFilterMiddleware({ mode: 'allowlist', ips: ['10.0.0.0/8'] });
    const req = makeMockReq('8.8.8.8');
    const { res, statusCode, body } = makeMockRes();
    const next = jest.fn();
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(statusCode()).toBe(403);
    expect(JSON.parse(body()).error).toBe('Forbidden');
  });
});
