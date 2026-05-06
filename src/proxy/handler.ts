import http, { IncomingMessage, ServerResponse } from 'http';
import https from 'https';
import { Config } from '../config/schema';
import { matchRoute } from './matcher';
import { rewriteRequestHeaders, rewriteResponseHeaders, buildTargetUrl } from './rewriter';
import { createRateLimitMiddleware } from '../middleware/rateLimit';
import { createAuthMiddleware, checkAuth } from '../middleware/auth';

export function createProxyHandler(config: Config) {
  const rateLimitMiddleware = config.rateLimit
    ? createRateLimitMiddleware(config.rateLimit.windowMs, config.rateLimit.maxRequests)
    : null;

  const globalAuthMiddleware = config.auth
    ? createAuthMiddleware(config.auth)
    : null;

  return function proxyHandler(req: IncomingMessage, res: ServerResponse): void {
    const runProxy = () => {
      const route = matchRoute(req, config.routes);

      if (!route) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No matching route' }));
        return;
      }

      if (route.auth && !checkAuth(req, route.auth)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      const targetUrl = buildTargetUrl(req, route);
      const parsed = new URL(targetUrl);
      const isHttps = parsed.protocol === 'https:';
      const transport = isHttps ? https : http;

      const outHeaders = rewriteRequestHeaders(req.headers, route);

      const proxyReq = transport.request(
        { hostname: parsed.hostname, port: parsed.port, path: parsed.pathname + parsed.search, method: req.method, headers: outHeaders },
        (proxyRes) => {
          const rewrittenHeaders = rewriteResponseHeaders(proxyRes.headers, route);
          res.writeHead(proxyRes.statusCode ?? 200, rewrittenHeaders);
          proxyRes.pipe(res);
        }
      );

      proxyReq.on('error', (err) => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bad Gateway', detail: err.message }));
      });

      req.pipe(proxyReq);
    };

    const withAuth = () => {
      if (globalAuthMiddleware) {
        globalAuthMiddleware(req, res, runProxy);
      } else {
        runProxy();
      }
    };

    if (rateLimitMiddleware) {
      rateLimitMiddleware(req, res, withAuth);
    } else {
      withAuth();
    }
  };
}
