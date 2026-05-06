import http from 'http';
import https from 'https';
import { URL } from 'url';
import { RouteConfig } from '../config/schema';
import { matchRoute } from './matcher';
import { rewriteRequestHeaders, rewriteResponseHeaders, buildTargetUrl } from './rewriter';

export interface ProxyHandlerOptions {
  routes: RouteConfig[];
  defaultTarget?: string;
}

export function createProxyHandler(options: ProxyHandlerOptions) {
  return function handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): void {
    const pathname = req.url ?? '/';
    const route = matchRoute(pathname, options.routes);

    if (!route && !options.defaultTarget) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('No matching route found');
      return;
    }

    const targetBase = route?.target ?? options.defaultTarget!;
    const targetUrl = buildTargetUrl(targetBase, pathname);
    const parsed = new URL(targetUrl);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;

    const outgoingHeaders = rewriteRequestHeaders(
      req.headers as Record<string, string>,
      route?.requestHeaders
    );

    const proxyReq = transport.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + (parsed.search ?? ''),
        method: req.method,
        headers: outgoingHeaders,
      },
      (proxyRes) => {
        const outHeaders = rewriteResponseHeaders(
          proxyRes.headers as Record<string, string>,
          route?.responseHeaders
        );
        res.writeHead(proxyRes.statusCode ?? 200, outHeaders);
        proxyRes.pipe(res, { end: true });
      }
    );

    proxyReq.on('error', (err) => {
      console.error('[patchwork-proxy] upstream error:', err.message);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end('Bad Gateway');
      }
    });

    req.pipe(proxyReq, { end: true });
  };
}
