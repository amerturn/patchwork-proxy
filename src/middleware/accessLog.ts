import fs from "fs";
import path from "path";
import { LogEntry } from "./logger";

export interface AccessLogOptions {
  filePath: string;
  format?: "json" | "combined";
}

function formatCombined(entry: LogEntry): string {
  return `${entry.clientIp} - [${entry.timestamp}] "${entry.method} ${entry.url}" ${entry.status} ${entry.durationMs}ms "${entry.userAgent ?? "-"}"`;
}

export function createFileLogger(
  options: AccessLogOptions
): (entry: LogEntry) => void {
  const dir = path.dirname(options.filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const stream = fs.createWriteStream(options.filePath, { flags: "a" });

  return (entry: LogEntry): void => {
    const line =
      options.format === "combined"
        ? formatCombined(entry)
        : JSON.stringify(entry);
    stream.write(line + "\n");
  };
}

export function createCompositeOutput(
  ...outputs: Array<(entry: LogEntry) => void>
): (entry: LogEntry) => void {
  return (entry: LogEntry): void => {
    for (const out of outputs) {
      out(entry);
    }
  };
}
