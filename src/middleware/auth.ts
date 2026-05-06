import { IncomingMessage, ServerResponse } from 'http';

export interface AuthConfig {
  type: 'bearer' | 'basic' | 'apikey';
  tokens?: string[];
  users?: Record<string, string>;
  header?: string;
}

export function extractBearerToken(req: IncomingMessage): string | null {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

export function extractApiKey(req: IncomingMessage, header = 'x-api-key'): string | null {
  const key = req.headers[header.toLowerCase()];
  return typeof key === 'string' ? key : null;
}

export function extractBasicCredentials(req: IncomingMessage): { user: string; pass: string } | null {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Basic ')) return null;
  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
  const colonIdx = decoded.indexOf(':');
  if (colonIdx === -1) return null;
  return { user: decoded.slice(0, colonIdx), pass: decoded.slice(colonIdx + 1) };
}

export function checkAuth(req: IncomingMessage, config: AuthConfig): boolean {
  if (config.type === 'bearer') {
    const token = extractBearerToken(req);
    return token !== null && (config.tokens ?? []).includes(token);
  }
  if (config.type === 'apikey') {
    const key = extractApiKey(req, config.header);
    return key !== null && (config.tokens ?? []).includes(key);
  }
  if (config.type === 'basic') {
    const creds = extractBasicCredentials(req);
    if (!creds) return false;
    const expected = (config.users ?? {})[creds.user];
    return expected !== undefined && expected === creds.pass;
  }
  return false;
}

export function createAuthMiddleware(config: AuthConfig) {
  return function authMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void
  ): void {
    if (checkAuth(req, config)) {
      next();
    } else {
      res.writeHead(401, {
        'Content-Type': 'application/json',
        'WWW-Authenticate': config.type === 'basic' ? 'Basic realm="patchwork-proxy"' : 'Bearer',
      });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
    }
  };
}
