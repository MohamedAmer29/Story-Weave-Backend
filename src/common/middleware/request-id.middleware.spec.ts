import { RequestIdMiddleware } from './request-id.middleware';

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
  });

  const makeMocks = () => {
    const headers: Record<string, string | undefined> = {};
    const setHeader = jest.fn();
    const req = { headers, setHeader, headers: {} } as any;
    req.headers = headers;
    const res = { setHeader } as any;
    const next = jest.fn();
    return { req, res, next, setHeader };
  };

  it('generates a requestId when none is supplied and sets response header', () => {
    const { req, res, next, setHeader } = makeMocks();
    middleware.use(req, res, next);
    expect(req.requestId).toBeDefined();
    expect(setHeader).toHaveBeenCalledWith('x-request-id', req.requestId);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('respects a client-supplied x-request-id', () => {
    const { req, res, next, setHeader } = makeMocks();
    req.headers['x-request-id'] = '  client-id-123  ';
    middleware.use(req, res, next);
    expect(req.requestId).toBe('client-id-123');
    expect(setHeader).toHaveBeenCalledWith('x-request-id', 'client-id-123');
  });

  it('ignores an empty/blank client-supplied id and generates its own', () => {
    const { req, res, next } = makeMocks();
    req.headers['x-request-id'] = '   ';
    middleware.use(req, res, next);
    expect(req.requestId).toBeDefined();
    expect(req.requestId).not.toBe('   ');
  });
});
