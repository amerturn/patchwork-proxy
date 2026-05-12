import http, { IncomingMessage, ServerResponse } from 'http';
import { createRequestSizeMiddleware, getAverageRequestSize, clearRequestSizeStore } from './requestSize';

function startServer(trackByRoute = false): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const middleware = createRequestSizeMiddleware({ trackByRoute });
    const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
      middleware(req, res, () => {
        res.writeHead(200);
        res.end('ok');
      });
    });
    server.listen(0, () => {
      const port = (server.address() as any).port as number;
      resolve({ server, port });
    });
  });
}

function post(port: number, path: string, body: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: 'localhost', port, path, method: 'POST' }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode ?? 0));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

beforeEach(() => clearRequestSizeStore());

describe('requestSize integration', () => {
  it('records global request sizes', async () => {
    const { server, port } = await startServer(false);
    try {
      await post(port, '/anything', 'hello world');
      await post(port, '/other', '12345678901234567890');
      const avg = getAverageRequestSize('__global__');
      expect(avg).toBeGreaterThan(0);
    } finally {
      server.close();
    }
  });

  it('records per-route request sizes when trackByRoute is true', async () => {
    const { server, port } = await startServer(true);
    try {
      await post(port, '/upload', 'some data here');
      const avg = getAverageRequestSize('/upload');
      expect(avg).toBeGreaterThan(0);
    } finally {
      server.close();
    }
  });

  it('returns 200 status for proxied request', async () => {
    const { server, port } = await startServer();
    try {
      const status = await post(port, '/test', 'payload');
      expect(status).toBe(200);
    } finally {
      server.close();
    }
  });
});
