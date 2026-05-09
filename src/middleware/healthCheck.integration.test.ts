import http, { IncomingMessage, ServerResponse } from 'http';
import { createHealthCheckMiddleware } from './healthCheck';

function startServer(
  options: Parameters<typeof createHealthCheckMiddleware>[0] = {}
): Promise<{ port: number; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const mw = createHealthCheckMiddleware(options);
    const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
      mw(req, res, () => {
        res.writeHead(404);
        res.end('not found');
      });
    });
    server.listen(0, () => {
      const addr = server.address() as { port: number };
      resolve({
        port: addr.port,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

function get(port: number, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http.get({ hostname: 'localhost', port, path }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
    }).on('error', reject);
  });
}

describe('healthCheck integration', () => {
  it('returns 200 JSON on /health', async () => {
    const { port, close } = await startServer({ includeUptime: true });
    try {
      const { status, body } = await get(port, '/health');
      expect(status).toBe(200);
      const json = JSON.parse(body);
      expect(json.status).toBe('ok');
      expect(typeof json.uptime).toBe('number');
      expect(json.timestamp).toBeDefined();
    } finally {
      await close();
    }
  });

  it('returns 503 when a check fails', async () => {
    const { port, close } = await startServer({
      extraChecks: { db: () => false },
    });
    try {
      const { status, body } = await get(port, '/health');
      expect(status).toBe(503);
      const json = JSON.parse(body);
      expect(json.status).toBe('degraded');
      expect(json.checks?.db).toBe(false);
    } finally {
      await close();
    }
  });

  it('passes through non-health requests', async () => {
    const { port, close } = await startServer();
    try {
      const { status } = await get(port, '/api/users');
      expect(status).toBe(404);
    } finally {
      await close();
    }
  });

  it('uses custom path', async () => {
    const { port, close } = await startServer({ path: '/ping' });
    try {
      const { status: healthStatus } = await get(port, '/health');
      expect(healthStatus).toBe(404);
      const { status: pingStatus } = await get(port, '/ping');
      expect(pingStatus).toBe(200);
    } finally {
      await close();
    }
  });
});
