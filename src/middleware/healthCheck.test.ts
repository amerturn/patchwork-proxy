import { IncomingMessage, ServerResponse } from 'http';
import {
  runHealthChecks,
  buildHealthPayload,
  createHealthCheckMiddleware,
} from './healthCheck';

function makeMockReq(url: string, method = 'GET'): Partial<IncomingMessage> {
  return { url, method };
}

function makeMockRes(): { res: Partial<ServerResponse>; written: any[] } {
  const written: any[] = [];
  const headers: Record<string, any> = {};
  let statusCode = 0;
  const res: Partial<ServerResponse> = {
    writeHead: (code: number, hdrs?: any) => {
      statusCode = code;
      Object.assign(headers, hdrs);
      return res as ServerResponse;
    },
    end: (body?: any) => {
      written.push({ statusCode, headers, body });
      return res as ServerResponse;
    },
  };
  return { res, written };
}

describe('runHealthChecks', () => {
  it('returns empty results when no checks provided', async () => {
    const { results, allPassed } = await runHealthChecks();
    expect(results).toEqual({});
    expect(allPassed).toBe(true);
  });

  it('captures passing checks', async () => {
    const { results, allPassed } = await runHealthChecks({ db: () => true });
    expect(results.db).toBe(true);
    expect(allPassed).toBe(true);
  });

  it('captures failing checks and sets allPassed to false', async () => {
    const { results, allPassed } = await runHealthChecks({
      db: () => false,
      cache: async () => true,
    });
    expect(results.db).toBe(false);
    expect(results.cache).toBe(true);
    expect(allPassed).toBe(false);
  });

  it('treats thrown errors as failed checks', async () => {
    const { results, allPassed } = await runHealthChecks({
      broken: () => { throw new Error('fail'); },
    });
    expect(results.broken).toBe(false);
    expect(allPassed).toBe(false);
  });
});

describe('buildHealthPayload', () => {
  it('returns ok status when all passed', () => {
    const p = buildHealthPayload({}, {}, true);
    expect(p.status).toBe('ok');
  });

  it('returns degraded status when not all passed', () => {
    const p = buildHealthPayload({}, {}, false);
    expect(p.status).toBe('degraded');
  });

  it('includes uptime when requested', () => {
    const p = buildHealthPayload({ includeUptime: true }, {}, true);
    expect(typeof p.uptime).toBe('number');
  });

  it('includes memory when requested', () => {
    const p = buildHealthPayload({ includeMemory: true }, {}, true);
    expect(p.memory).toBeDefined();
  });

  it('omits checks key when no extra checks', () => {
    const p = buildHealthPayload({}, {}, true);
    expect(p.checks).toBeUndefined();
  });
});

describe('createHealthCheckMiddleware', () => {
  it('calls next for non-health paths', async () => {
    const mw = createHealthCheckMiddleware();
    const req = makeMockReq('/api/data') as IncomingMessage;
    const { res } = makeMockRes();
    const next = jest.fn();
    await mw(req, res as ServerResponse, next);
    expect(next).toHaveBeenCalled();
  });

  it('responds 200 on /health with default options', async () => {
    const mw = createHealthCheckMiddleware();
    const req = makeMockReq('/health') as IncomingMessage;
    const { res, written } = makeMockRes();
    await mw(req, res as ServerResponse, jest.fn());
    expect(written[0].statusCode).toBe(200);
    const body = JSON.parse(written[0].body);
    expect(body.status).toBe('ok');
  });

  it('responds 503 when a check fails', async () => {
    const mw = createHealthCheckMiddleware({ extraChecks: { db: () => false } });
    const req = makeMockReq('/health') as IncomingMessage;
    const { res, written } = makeMockRes();
    await mw(req, res as ServerResponse, jest.fn());
    expect(written[0].statusCode).toBe(503);
  });

  it('respects custom path', async () => {
    const mw = createHealthCheckMiddleware({ path: '/ping' });
    const req = makeMockReq('/ping') as IncomingMessage;
    const { res, written } = makeMockRes();
    await mw(req, res as ServerResponse, jest.fn());
    expect(written[0].statusCode).toBe(200);
  });
});
