import { IncomingMessage, ServerResponse } from 'http';
import {
  getRequestSizeKey,
  recordRequestSize,
  getAverageRequestSize,
  getTotalRequestSize,
  clearRequestSizeStore,
  createRequestSizeMiddleware,
} from './requestSize';

function makeMockReq(url = '/test'): IncomingMessage {
  const req = Object.assign(Object.create(IncomingMessage.prototype), {
    url,
    headers: {},
    on: jest.fn(),
  }) as unknown as IncomingMessage;
  return req;
}

function makeMockRes(): ServerResponse {
  return {
    setHeader: jest.fn(),
    getHeader: jest.fn(),
    end: jest.fn(),
  } as unknown as ServerResponse;
}

beforeEach(() => clearRequestSizeStore());

describe('getRequestSizeKey', () => {
  it('returns route url when trackByRoute is true', () => {
    const req = makeMockReq('/api/data');
    expect(getRequestSizeKey(req, true)).toBe('/api/data');
  });

  it('returns __global__ when trackByRoute is false', () => {
    const req = makeMockReq('/api/data');
    expect(getRequestSizeKey(req, false)).toBe('__global__');
  });

  it('defaults to / when url is missing', () => {
    const req = makeMockReq(undefined as any);
    (req as any).url = undefined;
    expect(getRequestSizeKey(req, true)).toBe('/');
  });
});

describe('recordRequestSize / getAverageRequestSize', () => {
  it('records and averages correctly', () => {
    recordRequestSize('key1', 100);
    recordRequestSize('key1', 200);
    expect(getAverageRequestSize('key1')).toBe(150);
  });

  it('returns 0 for unknown key', () => {
    expect(getAverageRequestSize('unknown')).toBe(0);
  });

  it('tracks total bytes', () => {
    recordRequestSize('key2', 50);
    recordRequestSize('key2', 75);
    expect(getTotalRequestSize('key2')).toBe(125);
  });

  it('returns 0 total for unknown key', () => {
    expect(getTotalRequestSize('nope')).toBe(0);
  });
});

describe('createRequestSizeMiddleware', () => {
  it('calls next immediately', () => {
    const middleware = createRequestSizeMiddleware();
    const req = makeMockReq();
    const res = makeMockRes();
    const next = jest.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('attaches data and end listeners to req', () => {
    const middleware = createRequestSizeMiddleware({ trackByRoute: true });
    const req = makeMockReq('/upload');
    const res = makeMockRes();
    middleware(req, res, jest.fn());
    expect(req.on).toHaveBeenCalledWith('data', expect.any(Function));
    expect(req.on).toHaveBeenCalledWith('end', expect.any(Function));
  });
});
