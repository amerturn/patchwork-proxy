import http from "http";
import { createBodyLimitMiddleware } from "./bodyLimit";
import { applyMiddlewares } from "../server";

/** Start a minimal HTTP server with body limit middleware applied */
function startServer(maxBytes: string | number): http.Server {
  const bodyLimit = createBodyLimitMiddleware({ maxBytes });

  const server = http.createServer((req, res) => {
    applyMiddlewares([bodyLimit], req, res, () => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ received: body.length }));
      });
    });
  });

  return server;
}

/** Helper to send a POST request with a body and return the response */
function post(
  server: http.Server,
  body: string,
  contentLength?: number
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as { port: number };
    const len = contentLength !== undefined ? contentLength : Buffer.byteLength(body);
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: addr.port,
        path: "/",
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          "Content-Length": len,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/** Helper to start a server and resolve once it is listening */
function listen(server: http.Server): Promise<void> {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
}

describe("bodyLimit integration", () => {
  let server: http.Server;

  afterEach((done) => {
    if (server?.listening) server.close(done);
    else done();
  });

  it("allows requests within the body size limit", async () => {
    server = startServer("1kb");
    await listen(server);
    const smallBody = "a".repeat(512);
    const res = await post(server, smallBody);
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.received).toBe(512);
  });

  it("rejects requests exceeding the body size limit via Content-Length", async () => {
    server = startServer("1kb");
    await listen(server);
    const largeBody = "b".repeat(2048);
    const res = await post(server, largeBody);
    expect(res.status).toBe(413);
  });

  it("allows requests exactly at the limit", async () => {
    server = startServer(1024);
    await listen(server);
    const exactBody = "c".repeat(1024);
    const res = await post(server, exactBody);
    expect(res.status).toBe(200);
  });
});
