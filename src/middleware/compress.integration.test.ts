import http from 'http';
import { createCompressMiddleware } from './compress';
import { gunzip } from 'zlib';
import { promisify } from 'util';

const gunzipAsync = promisify(gunzip);

function startServer(body: string, contentType: string): Promise<http.Server> {
  const middleware = createCompressMiddleware({ threshold: 0 });
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', contentType);
    middleware(req, res, () => {
      res.statusCode = 200;
      res.end(body);
    });
  });
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

function getPort(server: http.Server): number {
  const addr = server.address();
  return typeof addr === 'object' && addr ? addr.port : 0;
}

async function fetchCompressed(
  port: number,
  encoding: string
): Promise<{ headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    http.get(
      { hostname: 'localhost', port, path: '/', headers: { 'accept-encoding': encoding } },
      (res) => {
        res.on('data', (d: Buffer) => chunks.push(d));
        res.on('end', () => resolve({ headers: res.headers, body: Buffer.concat(chunks) }));
        res.on('error', reject);
      }
    ).on('error', reject);
  });
}

describe('compress middleware integration', () => {
  let server: http.Server;
  const payload = JSON.stringify({ message: 'hello patchwork proxy', data: new Array(50).fill('x') });

  beforeAll(async () => {
    server = await startServer(payload, 'application/json');
  });

  afterAll((done) => server.close(done));

  it('compresses response with gzip when accepted', async () => {
    const port = getPort(server);
    const { headers, body } = await fetchCompressed(port, 'gzip');
    expect(headers['content-encoding']).toBe('gzip');
    const decompressed = await gunzipAsync(body);
    expect(decompressed.toString()).toBe(payload);
  });

  it('returns uncompressed response when encoding not accepted', async () => {
    const port = getPort(server);
    const { headers, body } = await fetchCompressed(port, 'identity');
    expect(headers['content-encoding']).toBeUndefined();
    expect(body.toString()).toBe(payload);
  });
});
