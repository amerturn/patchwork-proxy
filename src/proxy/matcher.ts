import { RouteConfig } from '../config/schema';

/**
 * Returns the first route whose path pattern matches the given URL.
 * Supports exact matches and wildcard suffix patterns (e.g. /api/*).
 */
export function matchRoute(
  url: string,
  routes: RouteConfig[]
): RouteConfig | undefined {
  for (const route of routes) {
    if (routeMatches(url, route.path)) {
      return route;
    }
  }
  return undefined;
}

export function routeMatches(url: string, pattern: string): boolean {
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2);
    return url === prefix || url.startsWith(prefix + '/');
  }

  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return url.startsWith(prefix);
  }

  // Exact match (ignore query string)
  const urlPath = url.split('?')[0];
  return urlPath === pattern;
}

export function sortRoutesBySpecificity(routes: RouteConfig[]): RouteConfig[] {
  return [...routes].sort((a, b) => {
    const aLen = a.path.replace(/\*$/, '').length;
    const bLen = b.path.replace(/\*$/, '').length;
    return bLen - aLen;
  });
}
