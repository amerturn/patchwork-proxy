import { EventEmitter } from "events";
import { createRequestLogger, LogEntry } from "./logger";

function makeMockReq(overrides: Record<string, unknown> = {}) {
  return {
    method: "GET",
    url: "/api/test",
    headers: {
      "user-agent": "test-agent/1.0",
    },
    socket: { remoteAddress: "127.0.0.1" },
    ...overrides,
  } as any;
}

function makeMockRes(statusCode = 200) {
  const emitter = new EventEmitter();
  return Object.assign(emitter, { statusCode }) as any;
}

describe("createRequestLogger", () => {
  it("calls output with correct log entry on response finish", () => {
    const captured: LogEntry[] = [];
    const middleware = createRequestLogger({ output: (e) => captured.push(e) });
    const req = makeMockReq();
    const res = makeMockRes(200);
    const next = jest.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalled();

    res.emit("finish");

    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].url).toBe("/api/test");
    expect(captured[0].status).toBe(200);
    expect(captured[0].clientIp).toBe("127.0.0.1");
    expect(captured[0].userAgent).toBe("test-agent/1.0");
    expect(typeof captured[0].durationMs).toBe("number");
    expect(typeof captured[0].timestamp).toBe("string");
  });

  it("extracts client IP from x-forwarded-for header", () => {
    const captured: LogEntry[] = [];
    const middleware = createRequestLogger({ output: (e) => captured.push(e) });
    const req = makeMockReq({
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
    });
    const res = makeMockRes(200);

    middleware(req, res, jest.fn());
    res.emit("finish");

    expect(captured[0].clientIp).toBe("203.0.113.5");
  });

  it("omits userAgent when header is absent", () => {
    const captured: LogEntry[] = [];
    const middleware = createRequestLogger({ output: (e) => captured.push(e) });
    const req = makeMockReq({ headers: {} });
    const res = makeMockRes(404);

    middleware(req, res, jest.fn());
    res.emit("finish");

    expect(captured[0].userAgent).toBeUndefined();
    expect(captured[0].status).toBe(404);
  });

  it("uses default output without crashing", () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    const middleware = createRequestLogger();
    const req = makeMockReq();
    const res = makeMockRes(200);

    middleware(req, res, jest.fn());
    res.emit("finish");

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
