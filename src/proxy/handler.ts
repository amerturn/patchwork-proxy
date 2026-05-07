import { IncomingMessage, ServerResponse, request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import { Config } from '../config/schema';
import { matchRoute } from './matcher';
import { buildTargetUrl, rewriteRequestHeaders, rewriteResponseHeaders } from './rewriter';
import { recordSuccess, recordFailure, isCircuitOpen } from '../middleware/circuitBreaker';
import { CircuitBreakerOptions } from '../middleware/circuitBreaker';

export function createProxyHandler(config: Config) {
  return function proxyHandler(req: IncomingMessage, res: ServerResponse): void {
    const route = matchRoute(req, config.routes);

    if (!route) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No matching route' }));
      return;
    }

    const cbOpts: CircuitBreakerOptions = {
      failureThreshold: route.circuitBreaker?.failureThreshold ?? 5,
      successThreshold: route.circuitBreaker?.successThreshold ?? 2,
      timeout: route.circuitBreaker?.timeout ?? 30000,
    };
    const cbKey = route.target;

    if (route.circuitBreaker && isCircuitOpen(cbKey, cbOpts)) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Service unavailable (circuit open)' }));
      return;
    }

    const targetUrl = buildTargetUrl(req, route);
    const outHeaders = rewriteRequestHeaders(req.headers, route.requestHeaders);
    const parsed = new URL(targetUrl);
    const isHttps = parsed.protocol === 'https:';
    const requester = isHttps ? httpsRequest : httpRequest;

    const proxyReq = requester(
      {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: req.method,
        headers: outHeaders,
      },
      (proxyRes) => {
        if (route.circuitBreaker) {
          const status = proxyRes.statusCode ?? 200;
          if (status >= 500) {
            recordFailure(cbKey, cbOpts);
          } else {
            recordSuccess(cbKey, cbOpts);
          }
        }
        const patchedHeaders = rewriteResponseHeaders(
          proxyRes.headers,
          route.responseHeaders
        );
        res.writeHead(proxyRes.statusCode ?? 200, patchedHeaders);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on('error', (err) => {
      if (route.circuitBreaker) recordFailure(cbKey, cbOpts);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad gateway', detail: err.message }));
    });

    req.pipe(proxyReq);
  };
}
