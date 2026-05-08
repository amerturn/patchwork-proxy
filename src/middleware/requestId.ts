import { IncomingMessage, ServerResponse } from 'http';
import { randomUUID } from 'crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

export function generateRequestId(): string {
  return randomUUID();
}

export function getExistingRequestId(req: IncomingMessage): string | undefined {
  const header = req.headers[REQUEST_ID_HEADER];
  if (Array.isArray(header)) return header[0];
  return header;
}

export function attachRequestId(req: IncomingMessage, id: string): void {
  (req as any).requestId = id;
  req.headers[REQUEST_ID_HEADER] = id;
}

export interface RequestIdOptions {
  /** If true, reuse the incoming x-request-id header when present */
  trustIncoming?: boolean;
  /** If true, echo the request id back in the response header */
  setResponseHeader?: boolean;
}

export function createRequestIdMiddleware(
  options: RequestIdOptions = {}
) {
  const { trustIncoming = true, setResponseHeader = true } = options;

  return function requestIdMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: (err?: unknown) => void
  ): void {
    const existing = trustIncoming ? getExistingRequestId(req) : undefined;
    const id = existing ?? generateRequestId();

    attachRequestId(req, id);

    if (setResponseHeader) {
      res.setHeader(REQUEST_ID_HEADER, id);
    }

    next();
  };
}
