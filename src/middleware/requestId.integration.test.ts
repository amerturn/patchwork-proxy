import http, { IncomingMessage, ServerResponse } from 'http';
import { createRequestIdMiddleware, REQUEST_ID_HEADER } from './requestId';

function startServer(options = {}): Promise<{ server: http.Server; port: number }> {
  const middleware = createRequestIdMiddleware(options);
  const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
    middleware(req, res, () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ requestId: (req as any).requestId }));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, () => {
      const port = (server.address() as any).port;
      resolve({ server, port });
    });
  });
}

function get(port: number, headers: Record<string, string> = {}): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = http.get({ port, path: '/', headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(data), headers: res.headers }));
    });
    req.on('error', reject);
  });
}

describe('requestId middleware integration', () => {
  let server: http.Server;
  let port: number;

  afterEach((done) => server.close(done));

  it('injects a request id into the response header', async () => {
    ({ server, port } = await startServer());
    const { headers, body } = await get(port);
    expect(headers[REQUEST_ID_HEADER]).toBeDefined();
    expect(headers[REQUEST_ID_HEADER]).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.requestId).toBe(headers[REQUEST_ID_HEADER]);
  });

  it('propagates an existing request id from the client', async () => {
    ({ server, port } = await startServer({ trustIncoming: true }));
    const { headers, body } = await get(port, { [REQUEST_ID_HEADER]: 'client-supplied-id' });
    expect(headers[REQUEST_ID_HEADER]).toBe('client-supplied-id');
    expect(body.requestId).toBe('client-supplied-id');
  });

  it('does not echo response header when setResponseHeader is false', async () => {
    ({ server, port } = await startServer({ setResponseHeader: false }));
    const { headers } = await get(port);
    expect(headers[REQUEST_ID_HEADER]).toBeUndefined();
  });
});
