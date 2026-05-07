import http from 'http';
import { loadConfig } from './config/loader';
import { createProxyHandler } from './proxy/handler';
import { createRateLimitMiddleware } from './middleware/rateLimit';
import { createAuthMiddleware } from './middleware/auth';
import { createRequestLogger } from './middleware/logger';
import { createCacheMiddleware } from './middleware/cache';

export type Middleware = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  next: () => void
) => void;

export function next(_res: http.ServerResponse, middlewares: Middleware[], index: number,
  req: http.IncomingMessage, finalHandler: () => void): void {
  if (index >= middlewares.length) return finalHandler();
  middlewares[index](req, _res, () =>
    next(_res, middlewares, index + 1, req, finalHandler)
  );
}

export function applyMiddlewares(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  middlewares: Middleware[],
  finalHandler: () => void
): void {
  next(res, middlewares, 0, req, finalHandler);
}

async function main() {
  const configPath = process.env.CONFIG_PATH ?? 'config.yaml';
  const config = await loadConfig(configPath);

  const middlewares: Middleware[] = [];

  middlewares.push(createRequestLogger());

  if (config.auth) {
    middlewares.push(createAuthMiddleware(config.auth));
  }

  if (config.rateLimit) {
    middlewares.push(createRateLimitMiddleware(config.rateLimit));
  }

  if (config.cache) {
    middlewares.push(createCacheMiddleware(config.cache));
  }

  const proxyHandler = createProxyHandler(config);

  const server = http.createServer((req, res) => {
    applyMiddlewares(req, res, middlewares, () => proxyHandler(req, res));
  });

  server.listen(config.port, config.host, () => {
    console.log(`patchwork-proxy listening on ${config.host}:${config.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
