import http from 'http';
import { loadConfig } from './config/loader';
import { createProxyHandler } from './proxy/handler';
import { createRateLimitMiddleware } from './middleware/rateLimit';
import { RateLimitOptions } from './middleware/rateLimit';

export async function startServer(configPath: string): Promise<http.Server> {
  const config = await loadConfig(configPath);
  const proxyHandler = createProxyHandler(config.routes);

  const rateLimitMiddleware = config.rateLimit
    ? createRateLimitMiddleware(config.rateLimit as RateLimitOptions)
    : null;

  const server = http.createServer((req, res) => {
    if (rateLimitMiddleware) {
      rateLimitMiddleware(req, res, () => proxyHandler(req, res));
    } else {
      proxyHandler(req, res);
    }
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(config.port, () => {
      console.log(`patchwork-proxy listening on port ${config.port}`);
      resolve(server);
    });
  });
}

if (require.main === module) {
  const configPath = process.argv[2] ?? 'patchwork.yaml';
  startServer(configPath).catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
