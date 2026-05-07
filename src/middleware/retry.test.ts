import { shouldRetry, getRetryDelay, createRetryMiddleware } from './retry';
import { IncomingMessage, ServerResponse } from 'http';

function makeMockReq(): IncomingMessage {
  return {} as IncomingMessage;
}

function makeMockRes(statusCode = 200): ServerResponse {
  return { statusCode } as ServerResponse;
}

describe('shouldRetry', () => {
  it('returns true when status code is in retryOn list', () => {
    expect(shouldRetry(502, [502, 503, 504])).toBe(true);
    expect(shouldRetry(503, [502, 503, 504])).toBe(true);
  });

  it('returns false when status code is not in retryOn list', () => {
    expect(shouldRetry(200, [502, 503, 504])).toBe(false);
    expect(shouldRetry(404, [502, 503, 504])).toBe(false);
  });
});

describe('getRetryDelay', () => {
  it('returns a delay greater than or equal to base delay on first attempt', () => {
    const delay = getRetryDelay(1, 100);
    expect(delay).toBeGreaterThanOrEqual(100);
  });

  it('returns increasing delay for subsequent attempts', () => {
    const delay1 = getRetryDelay(1, 100);
    const delay2 = getRetryDelay(2, 100);
    // delay2 base is 200, delay1 base is 100 — delay2 should generally be larger
    expect(delay2).toBeGreaterThanOrEqual(200);
    expect(delay1).toBeLessThan(delay2 + 100);
  });
});

describe('createRetryMiddleware', () => {
  it('calls next once when response is successful', async () => {
    const req = makeMockReq();
    const res = makeMockRes(200);
    const next = jest.fn().mockResolvedValue(undefined);
    const middleware = createRetryMiddleware({ maxRetries: 3, retryDelay: 0 });

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('retries up to maxRetries times on retryable status codes', async () => {
    const req = makeMockReq();
    const res = makeMockRes(502);
    const next = jest.fn().mockResolvedValue(undefined);
    const middleware = createRetryMiddleware({
      maxRetries: 2,
      retryDelay: 0,
      retryOn: [502],
    });

    await middleware(req, res, next);

    // 1 initial + 2 retries = 3 total calls
    expect(next).toHaveBeenCalledTimes(3);
  });

  it('does not retry on non-retryable status codes', async () => {
    const req = makeMockReq();
    const res = makeMockRes(404);
    const next = jest.fn().mockResolvedValue(undefined);
    const middleware = createRetryMiddleware({
      maxRetries: 3,
      retryDelay: 0,
      retryOn: [502, 503],
    });

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('stops retrying once response becomes successful', async () => {
    const req = makeMockReq();
    const res = { statusCode: 503 } as ServerResponse;
    let callCount = 0;
    const next = jest.fn().mockImplementation(async () => {
      callCount += 1;
      if (callCount >= 2) res.statusCode = 200;
    });
    const middleware = createRetryMiddleware({
      maxRetries: 3,
      retryDelay: 0,
      retryOn: [503],
    });

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(2);
  });
});
