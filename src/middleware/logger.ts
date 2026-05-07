import { IncomingMessage, ServerResponse } from "http";

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogEntry {
  timestamp: string;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  clientIp: string;
  userAgent?: string;
}

export interface LoggerOptions {
  level?: LogLevel;
  output?: (entry: LogEntry) => void;
}

const defaultOutput = (entry: LogEntry): void => {
  const line = JSON.stringify(entry);
  if (entry.status >= 500) {
    console.error(line);
  } else if (entry.status >= 400) {
    console.warn(line);
  } else {
    console.log(line);
  }
};

export function createRequestLogger(
  options: LoggerOptions = {}
): (req: IncomingMessage, res: ServerResponse, next: () => void) => void {
  const output = options.output ?? defaultOutput;

  return (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    const startTime = Date.now();
    const method = req.method ?? "UNKNOWN";
    const url = req.url ?? "/";
    const clientIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ??
      (req.socket?.remoteAddress ?? "unknown");
    const userAgent = req.headers["user-agent"];

    res.on("finish", () => {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        method,
        url,
        status: res.statusCode,
        durationMs: Date.now() - startTime,
        clientIp,
        ...(userAgent ? { userAgent } : {}),
      };
      output(entry);
    });

    next();
  };
}
