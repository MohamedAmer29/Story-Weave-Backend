import {
  HttpException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let response: { status: jest.Mock; json: jest.Mock };
  let request: {
    method: string;
    url: string;
    headers: Record<string, string | undefined>;
  };

  function makeHost() {
    return {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as any;
  }

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    request = {
      method: 'GET',
      url: '/api/stories',
      headers: {},
    };
  });

  it('returns a generic 500 for non-Http exceptions without leaking internals', () => {
    const err = new Error(
      'connection to postgresql://user:superSecret@host/db failed',
    );
    filter.catch(err, makeHost());

    expect(response.status).toHaveBeenCalledWith(500);
    const body = response.json.mock.calls[0][0];
    expect(body.message).toBe('Internal server error');
    expect(body.statusCode).toBe(500);
    expect(body.path).toBe('/api/stories');
    expect(body.requestId).toEqual(expect.any(String));
  });

  it('returns the safe message for a known HTTP exception', () => {
    filter.catch(new NotFoundException('Story not found'), makeHost());

    expect(response.status).toHaveBeenCalledWith(404);
    const body = response.json.mock.calls[0][0];
    expect(body.message).toBe('Story not found');
  });

  it('propagates a client-supplied x-request-id correlation header', () => {
    request.headers['x-request-id'] = 'client-trace-123';
    filter.catch(new NotFoundException('x'), makeHost());

    const body = response.json.mock.calls[0][0];
    expect(body.requestId).toBe('client-trace-123');
  });

  it('does not leak internal server error internals to the client', () => {
    filter.catch(
      new HttpException(
        'REDACT: private db connection string leaked here',
        // Simulate an unknown 5xx HttpException so we treat it as an internal error
        500,
      ),
      makeHost(),
    );

    const body = response.json.mock.calls[0][0];
    expect(body.message).toBe('Internal server error');
  });

  it('returns validation array messages from a BadRequestException', () => {
    const validation = new BadRequestException([
      'title must be shorter',
      'text is required',
    ]);
    filter.catch(validation, makeHost());

    const body = response.json.mock.calls[0][0];
    expect(body.message).toEqual(['title must be shorter', 'text is required']);
  });
});
