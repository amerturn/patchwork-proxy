import http from 'http';
import { clearMetricsStore, createMetricsMiddleware } from './metrics';

function startServer(metricsPath = '/__metrics'): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const middleware = createMetricsMiddleware(metricsPath);
    const server = http.createServer((req, res) => {
      middleware(req, res, () => {
        res.writeHead(req.url === '/fail' ? 500 : 200);
        res.end('ok');
      });
    });
    server.listen(0, () => {
      const port = (server.address() as any).port as number;
      resolve({ server, port });
    });
  });
}

function get(port: number, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http.get({ hostname: 'localhost', port, path }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    }).on('error', reject);
  });
}

beforeEach(() => clearMetricsStore());

describe('metrics middleware integration', () => {
  it('records hits and serves them on the metrics endpoint', async () => {
    const { server, port } = await startServer();
    try {
      await get(port, '/api/hello');
      await get(port, '/api/hello');
      const { status, body } = await get(port, '/__metrics');
      expect(status).toBe(200);
      const data = JSON.parse(body);
      expect(data['/api/hello'].hits).toBe(2);
      expect(data['/api/hello'].errors).toBe(0);
    } finally {
      server.close();
    }
  });

  it('records errors for 5xx responses', async () => {
    const { server, port } = await startServer();
    try {
      await get(port, '/fail');
      const { body } = await get(port, '/__metrics');
      const data = JSON.parse(body);
      expect(data['/fail'].errors).toBe(1);
    } finally {
      server.close();
    }
  });

  it('does not record the metrics endpoint itself as a route hit', async () => {
    const { server, port } = await startServer();
    try {
      await get(port, '/__metrics');
      const { body } = await get(port, '/__metrics');
      const data = JSON.parse(body);
      expect(data['/__metrics']).toBeUndefined();
    } finally {
      server.close();
    }
  });
});
