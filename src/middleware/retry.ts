import { IncomingMessage, ServerResponse } from 'http';

export interface RetryOptions {
  maxRetries: number;
  retryDelay: number; // ms
  retryOn: number[];  // HTTP status codes to retry on
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  retryDelay: 100,
  retryOn: [502, 503, 504],
};

export function shouldRetry(statusCode: number, retryOn: number[]): boolean {
  return retryOn.includes(statusCode);
}

export function getRetryDelay(attempt: number, baseDelay: number): number {
  // Exponential backoff with jitter
  const exponential = baseDelay * Math.pow(2, attempt - 1);
  const jitter = Math.random() * baseDelay * 0.5;
  return Math.floor(exponential + jitter);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type NextFn = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

export function createRetryMiddleware(
  options: Partial<RetryOptions> = {}
) {
  const opts: RetryOptions = { ...DEFAULT_OPTIONS, ...options };

  return function retryMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: NextFn
  ): Promise<void> {
    let attempt = 0;

    async function tryRequest(): Promise<void> {
      attempt += 1;

      await next(req, res);

      const statusCode = res.statusCode;

      if (
        attempt <= opts.maxRetries &&
        shouldRetry(statusCode, opts.retryOn)
      ) {
        const delay = getRetryDelay(attempt, opts.retryDelay);
        await sleep(delay);
        return tryRequest();
      }
    }

    return tryRequest();
  };
}
