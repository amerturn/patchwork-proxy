import { IncomingMessage, ServerResponse } from 'http';

export type ResponseTimeOptions = {
  header?: string;
  digits?: number;
  suffix?: boolean;
};

const DEFAULT_HEADER = 'X-Response-Time';
const DEFAULT_DIGITS = 3;

export function formatDuration(ms: number, digits: number, suffix: boolean): string {
  const fixed = ms.toFixed(digits);
  return suffix ? `${fixed}ms` : fixed;
}

export function createResponseTimeMiddleware(
  options: ResponseTimeOptions = {}
) {
  const header = options.header ?? DEFAULT_HEADER;
  const digits = options.digits ?? DEFAULT_DIGITS;
  const suffix = options.suffix !== false;

  return function responseTimeMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void
  ): void {
    const startAt = process.hrtime();

    function onFinish(): void {
      res.removeListener('finish', onFinish);
      res.removeListener('error', onFinish);

      const diff = process.hrtime(startAt);
      const ms = diff[0] * 1e3 + diff[1] * 1e-6;
      const value = formatDuration(ms, digits, suffix);

      if (!res.headersSent) {
        res.setHeader(header, value);
      }
    }

    res.on('finish', onFinish);
    res.on('error', onFinish);

    next();
  };
}
