import { describe, it, expect, beforeEach, vi } from 'vitest';
import { errorResponseSchema, makeRequestHandler } from './server';
import { z, ZodError } from 'zod';
import { setLogger } from './logger';

describe('makeRequestHandler', () => {
  it('should create a handler that validates input', async () => {
    const { handler } = makeRequestHandler({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: 'GET',
      path: '/api/hello',
      run: async ({ input, sendOutput }) => {
        return sendOutput({ greeting: `Hello, ${input.name}!` });
      }
    });

    const response = await handler(
      new Request('http://test.com/api/hello?name=test')
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ greeting: 'Hello, test!' });
  });

  it('should return 400 for invalid input', async () => {
    const { handler } = makeRequestHandler({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: 'GET',
      path: '/api/hello',
      run: async ({ input, sendOutput }) => {
        return sendOutput({ greeting: `Hello, ${input.name}!` });
      }
    });

    const response = await handler(
      new Request('http://test.com/api/hello')
    );

    expect(response.status).toBe(400);
  });

  it('should put path params in the input', async () => {
    const { handler } = makeRequestHandler({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: 'GET',
      path: '/api/hello/:name',
      run: async ({ input, sendOutput }) => {
        return sendOutput({ greeting: `Hello, ${input.name}!` });
      }
    });

    const response = await handler(
      new Request('http://test.com/api/hello/test')
    );
    const data = await response.json();

    expect(data).toEqual({ greeting: 'Hello, test!' });
  });

  it('should put query params in the input', async () => {
    const { handler } = makeRequestHandler({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: 'GET',
      path: '/api/hello',
      run: async ({ input, sendOutput }) => {
        return sendOutput({ greeting: `Hello, ${input.name}!` });
      }
    });

    const response = await handler(
      new Request('http://test.com/api/hello?name=test')
    );
    const data = await response.json();

    expect(data).toEqual({ greeting: 'Hello, test!' });
  });

  it('should put request body in the input', async () => {
    const { handler } = makeRequestHandler({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: 'POST',
      path: '/api/hello',
      run: async ({ input, sendOutput }) => {
        return sendOutput({ greeting: `Hello, ${input.name}!` });
      }
    });

    const response = await handler(
      new Request('http://test.com/api/hello', { method: 'POST', body: JSON.stringify({ name: 'test' }) })
    );
    const data = await response.json();

    expect(data).toEqual({ greeting: 'Hello, test!' });
  });

  it('should return a 405 if the method is not supported', async () => {
    const { handler } = makeRequestHandler({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: 'GET',
      path: '/api/hello',
      run: async ({ input, sendOutput }) => {
        return sendOutput({ greeting: `Hello, ${input.name}!` });
      }
    });

    const response = await handler(
      new Request('http://test.com/api/hello', { method: 'POST' })
    );

    expect(response.status).toBe(405);
  });

  it('should return a different status code if the handler returns a different status code', async () => {
    const statusCode = 404;

    const { handler } = makeRequestHandler({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: 'GET',
      path: '/api/hello',
      run: async ({ input, sendOutput }) => {
        return sendOutput({ greeting: `Hello, ${input.name}!` }, {
          status: statusCode
        });
      }
    });

    const response = await handler(
      new Request('http://test.com/api/hello?name=test')
    );

    expect(response.status).toBe(404);
  });

  it('should return custom headers if the handler returns custom headers', async () => {
    const { handler } = makeRequestHandler({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: 'GET',
      path: '/api/hello',
      run: async ({ input, sendOutput }) => {
        return sendOutput({ greeting: `Hello, ${input.name}!` }, {
          headers: {
            'X-Custom-Header': 'test'
          }
        });
      }
    });

    const response = await handler(
      new Request('http://test.com/api/hello?name=test')
    );

    expect(response.headers.get('X-Custom-Header')).toBe('test');
  });

  it('should return a 500 if the handler throws an uncaught error', async () => {
    const { handler } = makeRequestHandler({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: 'GET',
      path: '/api/hello',
      run: async () => {
        throw new Error('test');
      }
    });

    const response = await handler(
      new Request('http://test.com/api/hello?name=test')
    );

    expect(response.status).toBe(500);
  });
  it('should return a 401 if the handler expects a user to be authenticated', async () => {
    const { handler } = makeRequestHandler({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: 'GET',
      path: '/api/hello',
      run: async ({ input, sendOutput }) => {
        return sendOutput({ greeting: `Hello, ${input.name}!` });
      },
      // Deny the user for this test
      authenticate: async () => false
    });

    const response = await handler(
      new Request('http://test.com/api/hello?name=test')
    );

    expect(response.status).toBe(401);
  });

  it('should allow an explicit error response', async () => {
    const { handler } = makeRequestHandler({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: 'GET',
      path: '/api/hello',
      
      run: async ({ sendError }) => {
        return sendError({ status: 404, message: 'Not Found' });
      }
    });

    const response = await handler(
      new Request('http://test.com/api/hello?name=test')
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: 'Not Found' });
  });

  it('should allow an error response with data', async () => {
    const { handler } = makeRequestHandler({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: 'GET',
      path: '/api/hello',
      run: async ({ sendError }) => {
        return sendError({ status: 404, message: 'Not Found', data: { foo: 'bar' } });
      }
    });

    const response = await handler(
      new Request('http://test.com/api/hello?name=test')
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: 'Not Found', data: { foo: 'bar' } });
  });

  it('should respond with an error response that is parsable by the errorResponseSchema', async () => {
    const { handler } = makeRequestHandler({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: 'GET',
      path: '/api/hello',
      run: async ({ sendError }) => {
        return sendError({ status: 404, message: 'Not Found', data: { foo: 'bar' } });
      }
    });

    const response = await handler(
      new Request('http://test.com/api/hello?name=test')
    );

    // attempt to parse the response as an error response
    const parsed = errorResponseSchema.safeParse(await response.json());
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ message: 'Not Found', data: { foo: 'bar' } });
  });

  describe('logging', () => {
    let logs: { level: string, message: string, meta?: Record<string, any> }[] = [];

    beforeEach(() => {
      logs = [];

      setLogger({
        log: (level, message, meta) => {  
          logs.push({ level, message, meta });
        }
      });
    });

    it('should log a debug message when the handler begins', async () => {
      const { handler } = makeRequestHandler({
        input: z.object({ name: z.string() }),
        output: z.object({ greeting: z.string() }),
        method: 'GET',
        path: '/api/hello',
        run: async ({ sendOutput }) => {
          return sendOutput({ greeting: 'Hello, test!' });
        }
      });

      await handler(new Request('http://test.com/api/hello?name=test'));

      expect(logs?.[0]).toEqual({ level: 'debug', message: 'Handler GET /api/hello begin', meta: undefined });
    });

    it('should log a debug message when the request is successful', async () => {
      const { handler } = makeRequestHandler({
        input: z.object({ name: z.string() }),
        output: z.object({ greeting: z.string() }),
        method: 'GET',
        path: '/api/hello',
        run: async ({ sendOutput }) => {
          return sendOutput({ greeting: 'Hello, test!' });
        }
      });

      await handler(new Request('http://test.com/api/hello?name=test'));

      expect(logs?.[1]).toEqual({ level: 'debug', message: 'Handler GET /api/hello success 200', meta: undefined });
    });

    it('should log a debug when the request is successful with a custom status code', async () => {
      const { handler } = makeRequestHandler({
        input: z.object({ name: z.string() }),
        output: z.object({ greeting: z.string() }),
        method: 'GET',
        path: '/api/hello',
        run: async ({ sendOutput }) => {
          return sendOutput({ greeting: 'Hello, test!' }, { status: 201 });
        }
      });

      await handler(new Request('http://test.com/api/hello?name=test'));

      expect(logs?.[1]).toEqual({ level: 'debug', message: 'Handler GET /api/hello success 201', meta: undefined });
    });

    it('should log a debug message when the handler sends an error response', async () => {
      const { handler } = makeRequestHandler({
        input: z.object({ name: z.string() }),
        output: z.object({ greeting: z.string() }),
        method: 'GET',
        path: '/api/hello',
        run: async ({ sendError }) => {
          return sendError({ status: 404, message: 'Not Found' });
        }
      });

      await handler(new Request('http://test.com/api/hello?name=test'));

      expect(logs?.[1]).toEqual({ level: 'debug', message: 'Handler GET /api/hello error 404', meta: undefined });
    });

    it('should log an error 500 error', async () => {
      const { handler } = makeRequestHandler({
        input: z.object({ name: z.string() }),
        output: z.object({ greeting: z.string() }),
        method: 'GET',
        path: '/api/hello',
        run: async () => {
          throw new Error('test');
        }
      });

      await handler(new Request('http://test.com/api/hello?name=test'));

      expect(logs?.[1]).toEqual({ 
        level: 'error', 
        message: 'Handler GET /api/hello unhandled error when handling request', 
        meta: { 
          error: expect.any(Error),
          input: { name: 'test' },
          url: 'http://test.com/api/hello?name=test'
        } 
      });
    });

    it('should log a warning message when the method is not allowed', async () => {
      const { handler } = makeRequestHandler({
        input: z.object({ name: z.string() }),
        output: z.object({ greeting: z.string() }),
        method: 'GET',
        path: '/api/hello',
        run: async ({ sendOutput }) => {
          return sendOutput({ greeting: 'Hello, test!' });
        }
      });

      await handler(new Request('http://test.com/api/hello', { method: 'POST' }));

      expect(logs?.[1]).toEqual({ 
        level: 'warn', 
        message: 'Handler POST /api/hello invalid HTTP method: received POST, expected GET', 
        meta: {
          expectedMethod: 'GET',
          actualMethod: 'POST',
          url: 'http://test.com/api/hello'
        } 
      });
    });

    it('should log a debug message when the authentication returns false', async () => {
      const { handler } = makeRequestHandler({
        input: z.object({ name: z.string() }),
        output: z.object({ greeting: z.string() }),
        method: 'GET',
        path: '/api/hello',
        authenticate: async () => false,
        run: async ({ sendOutput }) => {
          return sendOutput({ greeting: 'Hello, test!' });
        }
      });

      await handler(new Request('http://test.com/api/hello?name=test'));

      expect(logs?.[1]).toEqual({ 
        level: 'debug', 
        message: 'Handler GET /api/hello authentication check returned false', 
        meta: {
          url: 'http://test.com/api/hello?name=test'
        } 
      });
    });

    it('should log an error when there is an unexpected error authenticating the user', async () => {
      const { handler } = makeRequestHandler({
        input: z.object({ name: z.string() }),
        output: z.object({ greeting: z.string() }),
        method: 'GET',
        path: '/api/hello',
        authenticate: async () => {
          throw new Error('test');
        },
        run: async ({ sendOutput }) => {
          return sendOutput({ greeting: 'Hello, test!' });
        }
      });

      await handler(new Request('http://test.com/api/hello?name=test'));

      expect(logs?.[1]).toEqual({ 
        level: 'error', 
        message: 'Handler GET /api/hello error during authentication check', 
        meta: { 
          error: expect.any(Error),
          url: 'http://test.com/api/hello?name=test'
        } 
      });
    });

    it('should log a warning message when the handler has a validation error', async () => {
      const { handler } = makeRequestHandler({
        input: z.object({ name: z.string() }),
        output: z.object({ greeting: z.string() }),
        method: 'GET',
        path: '/api/hello',
        run: async ({ sendOutput }) => {
          return sendOutput({ greeting: 'Hello, test!' });
        }
      });

      await handler(new Request('http://test.com/api/hello'));

      expect(logs?.[1]).toEqual({ 
        level: 'warn', 
        message: 'Handler GET /api/hello request validation failed', 
        meta: {
          validationError: expect.any(ZodError),
          receivedInput: {},
          url: 'http://test.com/api/hello'
        } 
      });
    });
  });
});

