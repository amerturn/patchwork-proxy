import http from "http";
import { loadConfig } from "./config/loader";
import { createProxyHandler } from "./proxy/handler";
import { createAuthMiddleware } from "./middleware/auth";
import { createRateLimitMiddleware } from "./middleware/rateLimit";
import { createRequestLogger } from "./middleware/logger";
import { createFileLogger, createCompositeOutput } from "./middleware/accessLog";
import { IncomingMessage, ServerResponse } from "http";

type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

function applyMiddlewares(middlewares: Middleware[], req: IncomingMessage, res: ServerResponse, final: () => void): void {
  let index = 0;
  function next() {
    if (index < middlewares.length) {
      middlewares[index++](req, res, next);
    } else {
      final();
    }
  }
  next();
}

async function main() {
  const configPath = process.env.CONFIG_PATH ?? "config.yaml";
  const config = await loadConfig(configPath);

  const fileOutput = config.logging?.file
    ? createFileLogger({ filePath: config.logging.file, format: config.logging.format ?? "json" })
    : undefined;

  const logOutput = fileOutput
    ? createCompositeOutput((e) => console.log(JSON.stringify(e)), fileOutput)
    : undefined;

  const middlewares: Middleware[] = [
    createRequestLogger(logOutput ? { output: logOutput } : {}),
    ...(config.auth ? [createAuthMiddleware(config.auth)] : []),
    ...(config.rateLimit ? [createRateLimitMiddleware(config.rateLimit)] : []),
  ];

  const proxyHandler = createProxyHandler(config);

  const server = http.createServer((req, res) => {
    applyMiddlewares(middlewares, req, res, () => proxyHandler(req, res));
  });

  const port = config.port ?? 8080;
  server.listen(port, () => {
    console.log(JSON.stringify({ level: "info", message: `patchwork-proxy listening on port ${port}` }));
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
