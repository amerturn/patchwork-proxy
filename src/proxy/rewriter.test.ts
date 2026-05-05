import { rewriteRequestHeaders, rewriteResponseHeaders, buildTargetUrl } from './rewriter';
import { RouteConfig } from '../config/schema';

const baseRoute: RouteConfig = {
  path: '/api/*',
  target: 'http://backend:3000',
};

describe('rewriteRequestHeaders', () => {
  it('returns headers unchanged when no request rewrites defined', () => {
    const headers = { 'content-type': 'application/json', host: 'localhost' };
    expect(rewriteRequestHeaders(headers, baseRoute)).toEqual(headers);
  });

  it('adds a new header', () => {
    const route: RouteConfig = { ...baseRoute, headers: { request: { 'x-proxy': 'patchwork' } } };
    const result = rewriteRequestHeaders({ host: 'localhost' }, route);
    expect(result['x-proxy']).toBe('patchwork');
  });

  it('removes a header when value is null', () => {
    const route: RouteConfig = { ...baseRoute, headers: { request: { host: null } } };
    const result = rewriteRequestHeaders({ host: 'localhost' }, route);
    expect(result['host']).toBeUndefined();
  });

  it('overwrites an existing header', () => {
    const route: RouteConfig = { ...baseRoute, headers: { request: { authorization: 'Bearer token123' } } };
    const result = rewriteRequestHeaders({ authorization: 'Bearer old' }, route);
    expect(result['authorization']).toBe('Bearer token123');
  });
});

describe('rewriteResponseHeaders', () => {
  it('returns headers unchanged when no response rewrites defined', () => {
    const headers = { 'content-type': 'text/html' };
    expect(rewriteResponseHeaders(headers, baseRoute)).toEqual(headers);
  });

  it('adds a response header', () => {
    const route: RouteConfig = { ...baseRoute, headers: { response: { 'x-frame-options': 'DENY' } } };
    const result = rewriteResponseHeaders({}, route);
    expect(result['x-frame-options']).toBe('DENY');
  });

  it('removes a response header when value is null', () => {
    const route: RouteConfig = { ...baseRoute, headers: { response: { 'x-powered-by': null } } };
    const result = rewriteResponseHeaders({ 'x-powered-by': 'Express' }, route);
    expect(result['x-powered-by']).toBeUndefined();
  });
});

describe('buildTargetUrl', () => {
  it('strips route prefix and appends to target', () => {
    expect(buildTargetUrl('/api/users', baseRoute)).toBe('http://backend:3000/users');
  });

  it('handles root path with no remainder', () => {
    const route: RouteConfig = { path: '/api/*', target: 'http://backend:3000' };
    expect(buildTargetUrl('/api/', route)).toBe('http://backend:3000/');
  });

  it('handles nested paths', () => {
    expect(buildTargetUrl('/api/v1/orders/42', baseRoute)).toBe('http://backend:3000/v1/orders/42');
  });
});
