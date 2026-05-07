import { IncomingMessage, ServerResponse } from 'http';
import { createGzip, createDeflate } from 'zlib';
import { pipeline } from 'stream';

export type Encoding = 'gzip' | 'deflate' | 'identity';

export interface CompressOptions {
  threshold?: number; // bytes, default 1024
  encodings?: Encoding[];
}

const DEFAULT_THRESHOLD = 1024;
const DEFAULT_ENCODINGS: Encoding[] = ['gzip', 'deflate'];

export function selectEncoding(
  acceptEncoding: string | undefined,
  supported: Encoding[]
): Encoding {
  if (!acceptEncoding) return 'identity';
  for (const enc of supported) {
    if (acceptEncoding.includes(enc)) return enc;
  }
  return 'identity';
}

export function shouldCompress(
  res: ServerResponse,
  bodyLength: number,
  threshold: number
): boolean {
  const contentType = res.getHeader('content-type') as string | undefined;
  if (!contentType) return false;
  const compressible = /text|json|javascript|xml|svg/.test(contentType);
  return compressible && bodyLength >= threshold;
}

export function createCompressMiddleware(options: CompressOptions = {}) {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const encodings = options.encodings ?? DEFAULT_ENCODINGS;

  return function compressMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: (err?: unknown) => void
  ): void {
    const acceptEncoding = req.headers['accept-encoding'] as string | undefined;
    const encoding = selectEncoding(acceptEncoding, encodings);

    if (encoding === 'identity') {
      return next();
    }

    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);
    const chunks: Buffer[] = [];

    res.write = (chunk: unknown): boolean => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
      return true;
    };

    res.end = (chunk?: unknown): ServerResponse => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
      }
      const body = Buffer.concat(chunks);

      if (!shouldCompress(res, body.length, threshold)) {
        res.write = originalWrite;
        res.end = originalEnd;
        originalEnd(body);
        return res;
      }

      const compressor = encoding === 'gzip' ? createGzip() : createDeflate();
      res.setHeader('Content-Encoding', encoding);
      res.removeHeader('Content-Length');
      res.write = originalWrite;
      res.end = originalEnd;

      const buffers: Buffer[] = [];
      compressor.on('data', (d: Buffer) => buffers.push(d));
      compressor.on('end', () => originalEnd(Buffer.concat(buffers)));
      compressor.write(body);
      compressor.end();
      return res;
    };

    next();
  };
}
