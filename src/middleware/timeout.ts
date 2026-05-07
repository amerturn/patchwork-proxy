import { IncomingMessage, ServerResponse } from 'http';

export type NextFunction = (err?: Error) => void;

export interface TimeoutOptions {
  timeoutMs: number;
  message?: string;
  statusCode?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MESSAGE = 'Gateway Timeout';
const DEFAULT_STATUS = 504;

export function createTimeoutMiddleware(options: Partial<TimeoutOptions> = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const message = options.message ?? DEFAULT_MESSAGE;
  const statusCode = options.statusCode ?? DEFAULT_STATUS;

  return function timeoutMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: NextFunction
  ): void {
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      if (!res.headersSent) {
        res.writeHead(statusCode, { 'Content-Type': 'text/plain' });
        res.end(message);
      }
    }, timeoutMs);

    // Ensure the timer doesn't keep the process alive
    if (timer.unref) {
      timer.unref();
    }

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));

    if (timedOut) return;
    next();
  };
}
