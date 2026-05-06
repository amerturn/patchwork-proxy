import { RouteConfig } from '../config/schema';

/**
 * Checks whether a single route matches the given path and HTTP method.
 */
export function routeMatches(
  route: RouteConfig,
  path: string,
  method: string
): boolean {
  if (!pathMatches(route.path, path)) {
    return false;
  }
  if (route.methods && route.methods.length > 0) {
    return route.methods.map((m) => m.toUpperCase()).includes(method.toUpperCase());
  }
  return true;
}

/**
 * Matches a route path pattern against an incoming request path.
 * Supports trailing wildcard (*) patterns.
 */
function pathMatches(pattern: string, path: string): boolean {
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2);
    return path === prefix || path.startsWith(prefix + '/');
  }
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return path.startsWith(prefix);
  }
  return pattern === path;
}

/**
 * Sorts routes from most specific to least specific.
 * Specificity is determined by path length and presence of method constraints.
 */
export function sortRoutesBySpecificity(routes: RouteConfig[]): RouteConfig[] {
  return [...routes].sort((a, b) => {
    const aWild = a.path.includes('*') ? 0 : 1;
    const bWild = b.path.includes('*') ? 0 : 1;
    if (aWild !== bWild) return bWild - aWild;

    const lenDiff = b.path.length - a.path.length;
    if (lenDiff !== 0) return lenDiff;

    const aMethods = a.methods && a.methods.length > 0 ? 1 : 0;
    const bMethods = b.methods && b.methods.length > 0 ? 1 : 0;
    return bMethods - aMethods;
  });
}

/**
 * Finds the best matching route for a given path and method.
 */
export function matchRoute(
  routes: RouteConfig[],
  path: string,
  method: string
): RouteConfig | undefined {
  const sorted = sortRoutesBySpecificity(routes);
  return sorted.find((route) => routeMatches(route, path, method));
}
