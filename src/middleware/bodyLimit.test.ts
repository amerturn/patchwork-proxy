import { describe, it, expect, beforeEach } from "vitest";
import { IncomingMessage, ServerResponse } from "http";
import { Socket } from "net";
import {
  parseMaxBytes,
  getContentLength,
  createBodyLimitMiddleware,
} from "./bodyLimit";

function makeMockReq(headers: Record<string, string> = {}): IncomingMessage {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  Object.assign(req.headers, headers);
  return req;
}

function makeMockRes(): ServerResponse & { statusCode: number; body: string } {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  const res = new ServerResponse(req) as ServerResponse & { statusCode: number; body: string };
  res.body = "";
  const originalEnd = res.end.bind(res);
  res.end = (chunk?: unknown) => {
    if (chunk) res.body += chunk.toString();
    return originalEnd(chunk as never);
  };
  return res;
}

describe("parseMaxBytes", () => {
  it("parses raw number", () => expect(parseMaxBytes(1024)).toBe(1024));
  it("parses bytes string", () => expect(parseMaxBytes("512b")).toBe(512));
  it("parses kilobytes", () => expect(parseMaxBytes("2kb")).toBe(2048));
  it("parses megabytes", () => expect(parseMaxBytes("1mb")).toBe(1048576));
  it("throws on invalid", () => expect(() => parseMaxBytes("abc")).toThrow());
});

describe("getContentLength", () => {
  it("returns null when header missing", () => {
    const req = makeMockReq();
    expect(getContentLength(req)).toBeNull();
  });

  it("returns parsed integer", () => {
    const req = makeMockReq({ "content-length": "256" });
    expect(getContentLength(req)).toBe(256);
  });

  it("returns null for non-numeric header", () => {
    const req = makeMockReq({ "content-length": "abc" });
    expect(getContentLength(req)).toBeNull();
  });
});

describe("createBodyLimitMiddleware", () => {
  it("calls next when content-length is within limit", () => {
    const req = makeMockReq({ "content-length": "100" });
    const res = makeMockRes();
    const middleware = createBodyLimitMiddleware({ maxBytes: 1024 });
    let called = false;
    middleware(req, res, () => { called = true; });
    expect(called).toBe(true);
  });

  it("responds 413 when content-length exceeds limit", () => {
    const req = makeMockReq({ "content-length": "2048" });
    const res = makeMockRes();
    const middleware = createBodyLimitMiddleware({ maxBytes: 1024 });
    let called = false;
    middleware(req, res, () => { called = true; });
    expect(called).toBe(false);
    expect(res.statusCode).toBe(413);
    expect(res.body).toContain("too large");
  });

  it("uses custom message when provided", () => {
    const req = makeMockReq({ "content-length": "9999" });
    const res = makeMockRes();
    const middleware = createBodyLimitMiddleware({ maxBytes: 100, message: "Payload too big" });
    middleware(req, res, () => {});
    expect(res.body).toContain("Payload too big");
  });

  it("calls next when no content-length header present", () => {
    const req = makeMockReq();
    const res = makeMockRes();
    const middleware = createBodyLimitMiddleware({ maxBytes: 1024 });
    let called = false;
    middleware(req, res, () => { called = true; });
    expect(called).toBe(true);
  });
});
