import {
  clearCircuitStore,
  createCircuitBreakerMiddleware,
  recordFailure,
  recordSuccess,
  getCircuit,
} from './circuitBreaker';

function makeReq(routeKey: string) {
  return { url: '/test', headers: {}, routeKey } as any;
}

function makeRes() {
  const body: string[] = [];
  return {
    writeHead: jest.fn(),
    end: jest.fn((chunk: string) => body.push(chunk)),
    _body: body,
  } as any;
}

beforeEach(() => clearCircuitStore());

test('full lifecycle: CLOSED -> OPEN -> HALF_OPEN -> CLOSED', async () => {
  const opts = { failureThreshold: 2, successThreshold: 1, timeout: 20 };
  const mw = createCircuitBreakerMiddleware(opts);

  // CLOSED — requests pass
  let next = jest.fn();
  mw(makeReq('svc'), makeRes(), next);
  expect(next).toHaveBeenCalledTimes(1);

  // Trigger failures externally (simulating upstream errors)
  recordFailure('svc', opts);
  recordFailure('svc', opts);
  expect(getCircuit('svc').state).toBe('OPEN');

  // OPEN — requests blocked
  next = jest.fn();
  const res = makeRes();
  mw(makeReq('svc'), res, next);
  expect(next).not.toHaveBeenCalled();
  expect(res.writeHead).toHaveBeenCalledWith(503, expect.any(Object));

  // Wait for timeout -> HALF_OPEN
  await new Promise((r) => setTimeout(r, 30));
  next = jest.fn();
  mw(makeReq('svc'), makeRes(), next);
  expect(next).toHaveBeenCalledTimes(1);
  expect(getCircuit('svc').state).toBe('HALF_OPEN');

  // Record success -> CLOSED
  recordSuccess('svc', opts);
  expect(getCircuit('svc').state).toBe('CLOSED');
});

test('HALF_OPEN re-opens on failure', async () => {
  const opts = { failureThreshold: 2, successThreshold: 2, timeout: 15 };
  recordFailure('svc2', opts);
  recordFailure('svc2', opts);
  await new Promise((r) => setTimeout(r, 20));
  expect(getCircuit('svc2').state).toBe('OPEN'); // still OPEN until probed
  // transition to HALF_OPEN
  getCircuit('svc2').state = 'HALF_OPEN';
  recordFailure('svc2', opts);
  expect(getCircuit('svc2').state).toBe('OPEN');
});
