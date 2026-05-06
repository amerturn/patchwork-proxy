import { matchRoute, routeMatches, sortRoutesBySpecificity } from './matcher';
import { RouteConfig } from '../config/schema';

const makeRoute = (path: string, methods?: string[]): RouteConfig => ({
  path,
  target: 'http://backend:3000',
  ...(methods ? { methods } : {}),
});

describe('routeMatches', () => {
  it('matches exact path', () => {
    expect(routeMatches(makeRoute('/api/users'), '/api/users', 'GET')).toBe(true);
  });

  it('matches wildcard path', () => {
    expect(routeMatches(makeRoute('/api/*'), '/api/users', 'GET')).toBe(true);
  });

  it('does not match unrelated path', () => {
    expect(routeMatches(makeRoute('/api/users'), '/api/posts', 'GET')).toBe(false);
  });

  it('matches when method is in allowed list', () => {
    expect(routeMatches(makeRoute('/api/users', ['GET', 'POST']), '/api/users', 'POST')).toBe(true);
  });

  it('does not match when method is not in allowed list', () => {
    expect(routeMatches(makeRoute('/api/users', ['GET']), '/api/users', 'DELETE')).toBe(false);
  });

  it('matches any method when methods not specified', () => {
    expect(routeMatches(makeRoute('/api/users'), '/api/users', 'DELETE')).toBe(true);
  });
});

describe('sortRoutesBySpecificity', () => {
  it('sorts more specific routes first', () => {
    const routes = [
      makeRoute('/api/*'),
      makeRoute('/api/users/profile'),
      makeRoute('/api/users'),
    ];
    const sorted = sortRoutesBySpecificity(routes);
    expect(sorted[0].path).toBe('/api/users/profile');
    expect(sorted[sorted.length - 1].path).toBe('/api/*');
  });

  it('routes with methods come before routes without', () => {
    const routes = [
      makeRoute('/api/users'),
      makeRoute('/api/users', ['GET']),
    ];
    const sorted = sortRoutesBySpecificity(routes);
    expect(sorted[0].methods).toEqual(['GET']);
  });
});

describe('matchRoute', () => {
  it('returns the best matching route', () => {
    const routes = [
      makeRoute('/api/*'),
      makeRoute('/api/users'),
    ];
    const match = matchRoute(routes, '/api/users', 'GET');
    expect(match?.path).toBe('/api/users');
  });

  it('returns undefined when no route matches', () => {
    const routes = [makeRoute('/api/users')];
    expect(matchRoute(routes, '/other', 'GET')).toBeUndefined();
  });
});
