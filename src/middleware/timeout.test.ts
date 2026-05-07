import { IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';
import { createTimeoutMiddleware } from './timeout';

function makeMockReq(): IncomingMessage {
  return new IncomingMessage(new Socket());
}

function makeMockRes(): ServerResponse {
  const req = makeMockReq();
  const res = new ServerResponse(req);
  res.writeHead = jest.fn();
  res.end = jest.fn();
  return res;
}

describe('createTimeoutMiddleware', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('calls next immediately without timing out', () => {
    const middleware = createTimeoutMiddleware({ timeoutMs: 1000 });
    const req = makeMockReq();
    const res = makeMockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.writeHead).not.toHaveBeenCalled();
  });

  it('sends 504 response when timeout elapses', () => {
    const middleware = createTimeoutMiddleware({ timeoutMs: 500 });
    const req = makeMockReq();
    const res = makeMockRes();
    (res as any).headersSent = false;
    const next = jest.fn();

    middleware(req, res, next);
    jest.advanceTimersByTime(600);

    expect(res.writeHead).toHaveBeenCalledWith(504, { 'Content-Type': 'text/plain' });
    expect(res.end).toHaveBeenCalledWith('Gateway Timeout');
  });

  it('uses custom statusCode and message', () => {
    const middleware = createTimeoutMiddleware({
      timeoutMs: 200,
      statusCode: 408,
      message: 'Request Timeout',
    });
    const req = makeMockReq();
    const res = makeMockRes();
    (res as any).headersSent = false;
    const next = jest.fn();

    middleware(req, res, next);
    jest.advanceTimersByTime(300);

    expect(res.writeHead).toHaveBeenCalledWith(408, { 'Content-Type': 'text/plain' });
    expect(res.end).toHaveBeenCalledWith('Request Timeout');
  });

  it('does not send response if headers already sent', () => {
    const middleware = createTimeoutMiddleware({ timeoutMs: 100 });
    const req = makeMockReq();
    const res = makeMockRes();
    (res as any).headersSent = true;
    const next = jest.fn();

    middleware(req, res, next);
    jest.advanceTimersByTime(200);

    expect(res.writeHead).not.toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
  });
});
