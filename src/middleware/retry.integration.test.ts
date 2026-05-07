import { createRetryMiddleware } from './retry';
import { IncomingMessage, ServerResponse } from 'http';

function makeReq(): IncomingMessage {
  return {} as IncomingMessage;
}

function makeRes(initialStatus = 503): ServerResponse {
  return { statusCode: initialStatus } as ServerResponse;
}

describe('retry middleware integration', () => {
  it('retries exactly maxRetries times then gives up', async () => {
    const req = makeReq();
    const res = makeRes(502);
    const calls: number[] = [];

    const next = jest.fn().mockImplementation(async () => {
      calls.push(Date.now());
    });

    const middleware = createRetryMiddleware({
      maxRetries: 2,
      retryDelay: 10,
      retryOn: [502],
    });

    await middleware(req, res, next);

    expect(calls).toHaveLength(3); // 1 initial + 2 retries
  });

  it('respects retryDelay between attempts', async () => {
    const req = makeReq();
    const res = makeRes(503);
    const timestamps: number[] = [];

    const next = jest.fn().mockImplementation(async () => {
      timestamps.push(Date.now());
    });

    const middleware = createRetryMiddleware({
      maxRetries: 2,
      retryDelay: 50,
      retryOn: [503],
    });

    await middleware(req, res, next);

    expect(timestamps).toHaveLength(3);
    const gap1 = timestamps[1] - timestamps[0];
    const gap2 = timestamps[2] - timestamps[1];
    // Each gap should be at least the base retryDelay
    expect(gap1).toBeGreaterThanOrEqual(45);
    expect(gap2).toBeGreaterThanOrEqual(45);
  });

  it('succeeds immediately without retry when upstream is healthy', async () => {
    const req = makeReq();
    const res = makeRes(200);
    const next = jest.fn().mockResolvedValue(undefined);

    const middleware = createRetryMiddleware({
      maxRetries: 3,
      retryDelay: 10,
      retryOn: [502, 503, 504],
    });

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
