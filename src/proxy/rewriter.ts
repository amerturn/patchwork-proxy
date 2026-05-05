import { IncomingMessage, ServerResponse } from 'http';
import { RouteConfig } from '../config/schema';

export interface RewriteContext {
  route: RouteConfig;
  req: IncomingMessage;
  res: ServerResponse;
}

export function rewriteRequestHeaders(
  headers: Record<string, string | string[] | undefined>,
  route: RouteConfig
): Record<string, string | string[] | undefined> {
  const result = { ...headers };

  if (!route.headers?.request) {
    return result;
  }

  for (const [key, value] of Object.entries(route.headers.request)) {
    const lowerKey = key.toLowerCase();
    if (value === null) {
      delete result[lowerKey];
    } else {
      result[lowerKey] = value;
    }
  }

  return result;
}

export function rewriteResponseHeaders(
  headers: Record<string, string | string[] | undefined>,
  route: RouteConfig
): Record<string, string | string[] | undefined> {
  const result = { ...headers };

  if (!route.headers?.response) {
    return result;
  }

  for (const [key, value] of Object.entries(route.headers.response)) {
    const lowerKey = key.toLowerCase();
    if (value === null) {
      delete result[lowerKey];
    } else {
      result[lowerKey] = value;
    }
  }

  return result;
}

export function buildTargetUrl(reqUrl: string, route: RouteConfig): string {
  const prefix = route.path.replace(/\*$/, '');
  const remainder = reqUrl.startsWith(prefix) ? reqUrl.slice(prefix.length) : reqUrl;
  const base = route.target.replace(/\/$/, '');
  return `${base}/${remainder.replace(/^\//, '')}`;
}
