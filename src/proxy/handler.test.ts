import http from 'http';
import { createProxyHandler } from './handler';
import { RouteConfig } from '../config/schema';

const mockRoutes: RouteConfig[] = [
  {
    path: '/api',
    target: 'http://localhost:9999',
    requestHeaders: { set: { 'x-proxy': 'patchwork' } },
    responseHeaders: { remove: ['x-powered-by'] },
  },
];

function makeMockReqRes(url: string) {
  const req = Object.assign(new http.IncomingMessage(null as any), {
    url,
    method: 'GET',
    headers: { host: 'localhost' },
  });
  const chunks: Buffer[] = [];
  const res = {
    headersSent: false,
    statusCode: 0,
    headers: {} as Record<string, unknown>,
    writeHead(code: number, headers: Record<string, unknown>) {
      this.statusCode = code;
      this.headers = headers;
      this.headersSent = true;
    },
    end(body?: string) {
      chunks.push(Buffer.from(body ?? ''));
    },
    write() {},
  } as unknown as http.ServerResponse;
  return { req, res, chunks };
}

describe('createProxyHandler', () => {
  it('returns 502 when no route matches and no defaultTarget', () => {
    const handler = createProxyHandler({ routes: mockRoutes });
    const { req, res, chunks } = makeMockReqRes('/unknown');
    handler(req, res);
    expect((res as any).statusCode).toBe(502);
    expect(chunks[0].toString()).toContain('No matching route found');
  });

  it('returns a function', () => {
    const handler = createProxyHandler({ routes: mockRoutes });
    expect(typeof handler).toBe('function');
  });

  it('uses defaultTarget when no route matches', (done) => {
    const server = http.createServer((_req, sRes) => {
      sRes.writeHead(200, { 'content-type': 'text/plain' });
      sRes.end('ok');
    });
    server.listen(0, () => {
      const port = (server.address() as any).port;
      const handler = createProxyHandler({
        routes: [],
        defaultTarget: `http://localhost:${port}`,
      });
      const { req, res } = makeMockReqRes('/');
      (res as any).pipe = () => {};
      handler(req, res);
      setTimeout(() => {
        server.close();
        done();
      }, 100);
    });
  });
});
