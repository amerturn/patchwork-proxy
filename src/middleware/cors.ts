import { IncomingMessage, ServerResponse } from 'http';

export interface CorsOptions {
  origins: string | string[];
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

export function isOriginAllowed(origin: string, allowed: string | string[]): boolean {
  if (allowed === '*') return true;
  if (Array.isArray(allowed)) {
    return allowed.some((a) => a === '*' || a === origin);
  }
  return allowed === origin;
}

export function applyCorsHeaders(
  req: IncomingMessage,
  res: ServerResponse,
  options: CorsOptions
): void {
  const origin = req.headers['origin'] as string | undefined;
  const allowedOrigins = options.origins;

  if (origin && isOriginAllowed(origin, allowedOrigins)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (allowedOrigins === '*') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  const methods = options.methods ?? ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
  res.setHeader('Access-Control-Allow-Methods', methods.join(', '));

  if (options.allowedHeaders && options.allowedHeaders.length > 0) {
    res.setHeader('Access-Control-Allow-Headers', options.allowedHeaders.join(', '));
  } else {
    const requestedHeaders = req.headers['access-control-request-headers'];
    if (requestedHeaders) {
      res.setHeader('Access-Control-Allow-Headers', requestedHeaders);
    }
  }

  if (options.exposedHeaders && options.exposedHeaders.length > 0) {
    res.setHeader('Access-Control-Expose-Headers', options.exposedHeaders.join(', '));
  }

  if (options.credentials) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  if (options.maxAge !== undefined) {
    res.setHeader('Access-Control-Max-Age', String(options.maxAge));
  }
}

export function createCorsMiddleware(
  options: CorsOptions
) {
  return function corsMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void
  ): void {
    applyCorsHeaders(req, res, options);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    next();
  };
}
