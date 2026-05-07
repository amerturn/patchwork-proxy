import fs from "fs";
import os from "os";
import path from "path";
import { createFileLogger, createCompositeOutput } from "./accessLog";
import { LogEntry } from "./logger";

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    method: "GET",
    url: "/health",
    status: 200,
    durationMs: 12,
    clientIp: "10.0.0.1",
    ...overrides,
  };
}

describe("createFileLogger", () => {
  let tmpDir: string;
  let logFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "patchwork-log-"));
    logFile = path.join(tmpDir, "access.log");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes JSON entries to file", (done) => {
    const logger = createFileLogger({ filePath: logFile, format: "json" });
    const entry = makeEntry();
    logger(entry);

    setTimeout(() => {
      const content = fs.readFileSync(logFile, "utf-8");
      expect(JSON.parse(content.trim())).toMatchObject({ status: 200 });
      done();
    }, 50);
  });

  it("writes combined format entries to file", (done) => {
    const logger = createFileLogger({ filePath: logFile, format: "combined" });
    logger(makeEntry({ method: "POST", url: "/submit", status: 201 }));

    setTimeout(() => {
      const content = fs.readFileSync(logFile, "utf-8");
      expect(content).toContain("POST /submit");
      expect(content).toContain("201");
      done();
    }, 50);
  });

  it("creates directory if it does not exist", (done) => {
    const nested = path.join(tmpDir, "nested", "dir", "access.log");
    const logger = createFileLogger({ filePath: nested });
    logger(makeEntry());

    setTimeout(() => {
      expect(fs.existsSync(nested)).toBe(true);
      done();
    }, 50);
  });
});

describe("createCompositeOutput", () => {
  it("calls all outputs with the same entry", () => {
    const out1 = jest.fn();
    const out2 = jest.fn();
    const composite = createCompositeOutput(out1, out2);
    const entry = makeEntry();
    composite(entry);
    expect(out1).toHaveBeenCalledWith(entry);
    expect(out2).toHaveBeenCalledWith(entry);
  });
});
