import { describe, it, expect, beforeEach, vi } from "vitest";
import { errorResponseSchema, makeRequestHandler } from "./server";
import { z, ZodError } from "zod";
import { setLogger } from "./logger";

describe("makeRequestHandler", () => {
  it("should create a handler that validates input", async () => {
    const { handler } = makeRequestHandler({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: "GET",
      path: "/api/hello",
      run: async ({ input, sendOutput }) => {
        return sendOutput({ greeting: `Hello, ${input.name}!` });
      },
    });

    const response = await handler(
      new Request("http://test.com/api/hello?name=test")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ greeting: "Hello, test!" });
  });

  it("should return 400 for invalid input", async () => {
    const { handler } = makeRequestHandler({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: "GET",
      path: "/api/hello",
      run: async ({ input, sendOutput }) => {
        return sendOutput({ greeting: `Hello, ${input.name}!` });
      },
    });

    const response = await handler(new Request("http://test.com/api/hello"));

    expect(response.status).toBe(400);
  });

  it("should put path params in the input", async () => {
    const { handler } = makeRequestHandler({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: "GET",
      path: "/api/hello/:name",
      run: async ({ input, sendOutput }) => {
        return sendOutput({ greeting: `Hello, ${input.name}!` });
      },
    });

    const response = await handler(
      new Request("http://test.com/api/hello/test")
    );
    const data = await response.json();

    expect(data).toEqual({ greeting: "Hello, test!" });
  });

  it("should throw when path param is not defined in input schema", () => {
    expect(() =>
      makeRequestHandler({
        input: z.object({}), // id is not defined in the schema
        output: z.object({ post: z.string() }),
        method: "GET",
        path: "/api/posts/:id",
        run: async ({ sendOutput }) => {
          return sendOutput({ post: "test" });
        },
      })
    ).toThrow('Path parameter "id" in "/api/posts/:id" is not defined in the input schema');
  });

  it("should throw when multiple path params are not defined in input schema", () => {
    expect(() =>
      makeRequestHandler({
        input: z.object({}), // userId and postId are not defined in the schema
        output: z.object({ post: z.string() }),
        method: "GET",
        path: "/api/users/:userId/posts/:postId",
        run: async ({ sendOutput }) => {
          return sendOutput({ post: "test" });
        },
      })
    ).toThrow('Path parameters "userId", "postId" in "/api/users/:userId/posts/:postId" are not defined in the input schema');
  });

  it("should put query params in the input", async () => {
    const { handler } = makeRequestHandler({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: "GET",
      path: "/api/hello",
      run: async ({ input, sendOutput }) => {
        return sendOutput({ greeting: `Hello, ${input.name}!` });
      },
    });

    const response = await handler(
      new Request("http://test.com/api/hello?name=test")
    );
    const data = await response.json();

    expect(data).toEqual({ greeting: "Hello, test!" });
  });

  it("should put request body in the input", async () => {
    const { handler } = makeRequestHandler({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: "POST",
      path: "/api/hello",
      run: async ({ input, sendOutput }) => {
        return sendOutput({ greeting: `Hello, ${input.name}!` });
      },
    });

    const response = await handler(
      new Request("http://test.com/api/hello", {
        method: "POST",
        body: JSON.stringify({ name: "test" }),
      })
    );
    const data = await response.json();

    expect(data).toEqual({ greeting: "Hello, test!" });
  });

  it("should return a 400 error when the method is a post and the body is not JSON", async () => {
    const { handler } = makeRequestHandler({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: "POST",
      path: "/api/hello",
      run: async ({ input, sendOutput }) => {
        return sendOutput({ greeting: `Hello, ${input.name}!` });
      },
    });

    const response = await handler(
      new Request("http://test.com/api/hello", {
        method: "POST",
        body: "not-json",
      })
    );

    expect(response.status).toBe(400);
  });

  it("should allow for non-json request bodies if the input schema is an empty object", async () => {
    const { handler } = makeRequestHandler({
      input: z.object({}),
      output: z.object({ input: z.any() }),
      method: "POST",
      path: "/api/hello",
      run: async ({ input, sendOutput }) => {
        return sendOutput({ input });
      },
    });

    const response = await handler(
      new Request("http://test.com/api/hello", {
        method: "POST",
        body: "not-json",
      })
    );

    expect(response.status).toBe(200);
  });

  it("should allow for json request bodies if the input schema is an empty object", async () => {
    const { handler } = makeRequestHandler({
      input: z.object({}),
      output: z.object({ input: z.any() }),
      method: "POST",
      path: "/api/hello",
      run: async ({ input, sendOutput }) => {
        return sendOutput({ input });
      },
    });

    const response = await handler(
      new Request("http://test.com/api/hello", {
        method: "POST",
        body: JSON.stringify({ name: "test" }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ input: {} });
  });

  it("should return a 405 if the method is not supported", async () => {
    const { handler } = makeRequestHandler({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: "GET",
      path: "/api/hello",
      run: async ({ input, sendOutput }) => {
        return sendOutput({ greeting: `Hello, ${input.name}!` });
      },
    });

    const response = await handler(
      new Request("http://test.com/api/hello", { method: "POST" })
    );

    expect(response.status).toBe(405);
  });

  it("should return a different status code if the handler returns a different status code", async () => {
    const statusCode = 404;

    const { handler } = makeRequestHandler({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: "GET",
      path: "/api/hello",
      run: async ({ input, sendOutput }) => {
        return sendOutput(
          { greeting: `Hello, ${input.name}!` },
          {
            status: statusCode,
          }
        );
      },
    });

    const response = await handler(
      new Request("http://test.com/api/hello?name=test")
    );

    expect(response.status).toBe(404);
  });

  it("should return custom headers if the handler returns custom headers", async () => {
    const { handler } = makeRequestHandler({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: "GET",
      path: "/api/hello",
      run: async ({ input, sendOutput }) => {
        return sendOutput(
          { greeting: `Hello, ${input.name}!` },
          {
            headers: {
              "X-Custom-Header": "test",
            },
          }
        );
      },
    });

    const response = await handler(
      new Request("http://test.com/api/hello?name=test")
    );

    expect(response.headers.get("X-Custom-Header")).toBe("test");
  });

  it("should return a 500 if the handler throws an uncaught error", async () => {
    const { handler } = makeRequestHandler({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: "GET",
      path: "/api/hello",
      run: async () => {
        throw new Error("test");
      },
    });

    const response = await handler(
      new Request("http://test.com/api/hello?name=test")
    );

    expect(response.status).toBe(500);
  });
  it("should return a 401 if the handler expects a user to be authenticated", async () => {
    const { handler } = makeRequestHandler({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: "GET",
      path: "/api/hello",
      run: async ({ input, sendOutput }) => {
        return sendOutput({ greeting: `Hello, ${input.name}!` });
      },
      // Deny the user for this test
      authenticate: async () => false,
    });

    const response = await handler(
      new Request("http://test.com/api/hello?name=test")
    );

    expect(response.status).toBe(401);
  });

  it("should return a 401 if the authenticate function throws an error", async () => {
    const { handler } = makeRequestHandler({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: "GET",
      path: "/api/hello",
      run: async ({ input, sendOutput }) => {
        return sendOutput({ greeting: `Hello, ${input.name}!` });
      },
      authenticate: async () => {
        throw new Error("Auth service unavailable");
      },
    });

    const response = await handler(
      new Request("http://test.com/api/hello?name=test")
    );

    // Auth errors should fail closed (return 401), not fail open
    expect(response.status).toBe(401);
  });

  it("should allow an explicit error response", async () => {
    const { handler } = makeRequestHandler({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: "GET",
      path: "/api/hello",

      run: async ({ sendError }) => {
        return sendError({ status: 404, message: "Not Found" });
      },
    });

    const response = await handler(
      new Request("http://test.com/api/hello?name=test")
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: "Not Found" });
  });

  it("should allow an error response with data", async () => {
    const { handler } = makeRequestHandler({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: "GET",
      path: "/api/hello",
      run: async ({ sendError }) => {
        return sendError({
          status: 404,
          message: "Not Found",
          data: { foo: "bar" },
        });
      },
    });

    const response = await handler(
      new Request("http://test.com/api/hello?name=test")
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      message: "Not Found",
      data: { foo: "bar" },
    });
  });

  it("should respond with an error response that is parsable by the errorResponseSchema", async () => {
    const { handler } = makeRequestHandler({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: "GET",
      path: "/api/hello",
      run: async ({ sendError }) => {
        return sendError({
          status: 404,
          message: "Not Found",
          data: { foo: "bar" },
        });
      },
    });

    const response = await handler(
      new Request("http://test.com/api/hello?name=test")
    );

    // attempt to parse the response as an error response
    const parsed = errorResponseSchema.safeParse(await response.json());
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ message: "Not Found", data: { foo: "bar" } });
  });

  describe("logging", () => {
    let logs: { level: string; message: string; meta?: Record<string, any> }[] =
      [];

    beforeEach(() => {
      logs = [];

      setLogger({
        log: (level, message, meta) => {
          logs.push({ level, message, meta });
        },
      });
    });

    it("should log a debug message when the handler begins", async () => {
      const { handler } = makeRequestHandler({
        input: z.object({ name: z.string() }),
        output: z.object({ greeting: z.string() }),
        method: "GET",
        path: "/api/hello",
        run: async ({ sendOutput }) => {
          return sendOutput({ greeting: "Hello, test!" });
        },
      });

      await handler(new Request("http://test.com/api/hello?name=test"));

      expect(logs?.[0]).toEqual({
        level: "debug",
        message: "Handler GET /api/hello begin",
        meta: undefined,
      });
    });

    it("should log a debug message when the request is successful", async () => {
      const { handler } = makeRequestHandler({
        input: z.object({ name: z.string() }),
        output: z.object({ greeting: z.string() }),
        method: "GET",
        path: "/api/hello",
        run: async ({ sendOutput }) => {
          return sendOutput({ greeting: "Hello, test!" });
        },
      });

      await handler(new Request("http://test.com/api/hello?name=test"));

      expect(logs?.[1]).toEqual({
        level: "debug",
        message: "Handler GET /api/hello success 200",
        meta: undefined,
      });
    });

    it("should log a debug when the request is successful with a custom status code", async () => {
      const { handler } = makeRequestHandler({
        input: z.object({ name: z.string() }),
        output: z.object({ greeting: z.string() }),
        method: "GET",
        path: "/api/hello",
        run: async ({ sendOutput }) => {
          return sendOutput({ greeting: "Hello, test!" }, { status: 201 });
        },
      });

      await handler(new Request("http://test.com/api/hello?name=test"));

      expect(logs?.[1]).toEqual({
        level: "debug",
        message: "Handler GET /api/hello success 201",
        meta: undefined,
      });
    });

    it("should log a debug message when the handler sends an error response", async () => {
      const { handler } = makeRequestHandler({
        input: z.object({ name: z.string() }),
        output: z.object({ greeting: z.string() }),
        method: "GET",
        path: "/api/hello",
        run: async ({ sendError }) => {
          return sendError({ status: 404, message: "Not Found" });
        },
      });

      await handler(new Request("http://test.com/api/hello?name=test"));

      expect(logs?.[1]).toEqual({
        level: "debug",
        message: "Handler GET /api/hello error 404",
        meta: undefined,
      });
    });

    it("should log an error 500 error", async () => {
      const { handler } = makeRequestHandler({
        input: z.object({ name: z.string() }),
        output: z.object({ greeting: z.string() }),
        method: "GET",
        path: "/api/hello",
        run: async () => {
          throw new Error("test");
        },
      });

      await handler(new Request("http://test.com/api/hello?name=test"));

      expect(logs?.[1]).toEqual({
        level: "error",
        message: "Handler GET /api/hello unhandled error when handling request",
        meta: {
          error: expect.any(Error),
          input: { name: "test" },
          url: "http://test.com/api/hello?name=test",
        },
      });
    });

    it("should log a warning message when the method is not allowed", async () => {
      const { handler } = makeRequestHandler({
        input: z.object({ name: z.string() }),
        output: z.object({ greeting: z.string() }),
        method: "GET",
        path: "/api/hello",
        run: async ({ sendOutput }) => {
          return sendOutput({ greeting: "Hello, test!" });
        },
      });

      await handler(
        new Request("http://test.com/api/hello", { method: "POST" })
      );

      expect(logs?.[1]).toEqual({
        level: "warn",
        message:
          "Handler POST /api/hello invalid HTTP method: received POST, expected GET",
        meta: {
          expectedMethod: "GET",
          actualMethod: "POST",
          url: "http://test.com/api/hello",
        },
      });
    });

    it("should log a debug message when the authentication returns false", async () => {
      const { handler } = makeRequestHandler({
        input: z.object({ name: z.string() }),
        output: z.object({ greeting: z.string() }),
        method: "GET",
        path: "/api/hello",
        authenticate: async () => false,
        run: async ({ sendOutput }) => {
          return sendOutput({ greeting: "Hello, test!" });
        },
      });

      await handler(new Request("http://test.com/api/hello?name=test"));

      expect(logs?.[1]).toEqual({
        level: "debug",
        message: "Handler GET /api/hello authentication check returned false",
        meta: {
          url: "http://test.com/api/hello?name=test",
        },
      });
    });

    it("should log an error when there is an unexpected error authenticating the user", async () => {
      const { handler } = makeRequestHandler({
        input: z.object({ name: z.string() }),
        output: z.object({ greeting: z.string() }),
        method: "GET",
        path: "/api/hello",
        authenticate: async () => {
          throw new Error("test");
        },
        run: async ({ sendOutput }) => {
          return sendOutput({ greeting: "Hello, test!" });
        },
      });

      await handler(new Request("http://test.com/api/hello?name=test"));

      expect(logs?.[1]).toEqual({
        level: "error",
        message: "Handler GET /api/hello error during authentication check",
        meta: {
          error: expect.any(Error),
          url: "http://test.com/api/hello?name=test",
        },
      });
    });

    it("should log a warning message when the handler has a validation error", async () => {
      const { handler } = makeRequestHandler({
        input: z.object({ name: z.string() }),
        output: z.object({ greeting: z.string() }),
        method: "GET",
        path: "/api/hello",
        run: async ({ sendOutput }) => {
          return sendOutput({ greeting: "Hello, test!" });
        },
      });

      await handler(new Request("http://test.com/api/hello"));

      expect(logs?.[1]).toEqual({
        level: "warn",
        message: "Handler GET /api/hello request validation failed",
        meta: {
          validationError: expect.any(ZodError),
          receivedInput: {},
          url: "http://test.com/api/hello",
        },
      });
    });
  });

  describe("openAPIPathsObject", () => {
    it("should generate correct OpenAPI schema", () => {
      const { openAPIPathsObject } = makeRequestHandler({
        input: z.object({ name: z.string() }),
        output: z.object({ greeting: z.string() }),
        method: "GET",
        path: "/api/hello",
        run: async ({ input, sendOutput }) => {
          return sendOutput({ greeting: `Hello, ${input.name}!` });
        },
      });

      expect(openAPIPathsObject).toEqual({
        "/api/hello": {
          get: {
            description: undefined,
            parameters: [
              {
                name: "name",
                in: "query",
                required: true,
                schema: { type: "string" },
              },
            ],
            requestBody: undefined,
            responses: {
              200: {
                description: "Success",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        greeting: { type: "string" },
                      },
                      required: ["greeting"],
                      additionalProperties: false,
                    },
                  },
                },
              },
              400: expect.any(Object),
              401: undefined,
            },
            tags: undefined,
          },
        },
      });
    });

    it("should convert Express-style path params to OpenAPI format", () => {
      const { openAPIPathsObject } = makeRequestHandler({
        input: z.object({ userId: z.string(), postId: z.string() }),
        output: z.object({ post: z.string() }),
        method: "GET",
        path: "/api/users/:userId/posts/:postId",
        run: async ({ sendOutput }) => {
          return sendOutput({ post: "test" });
        },
      });

      // Path should use {param} syntax, not :param
      expect(Object.keys(openAPIPathsObject)).toEqual([
        "/api/users/{userId}/posts/{postId}",
      ]);
    });

    describe(".meta() examples in request/response bodies", () => {
      it("should include example and description in request body fields", () => {
        const { openAPIPathsObject } = makeRequestHandler({
          input: z.object({
            name: z.string().meta({
              example: "Alice",
              description: "User's full name",
            }),
            age: z.number().meta({
              example: 30,
              description: "User's age in years",
            }),
          }),
          output: z.object({ success: z.boolean() }),
          method: "POST",
          path: "/api/users",
          run: async ({ sendOutput }) => {
            return sendOutput({ success: true });
          },
        });

        const requestBody =
          openAPIPathsObject["/api/users"]?.post?.requestBody;
        expect(requestBody).toBeDefined();
        const schema = (requestBody as any)?.content?.["application/json"]
          ?.schema;

        expect(schema.properties.name).toMatchObject({
          type: "string",
          example: "Alice",
          description: "User's full name",
        });
        expect(schema.properties.age).toMatchObject({
          type: "number",
          example: 30,
          description: "User's age in years",
        });
      });

      it("should include examples in nested objects", () => {
        const { openAPIPathsObject } = makeRequestHandler({
          input: z.object({
            user: z.object({
              firstName: z.string().meta({ example: "John" }),
              lastName: z.string().meta({ example: "Doe" }),
              address: z.object({
                city: z.string().meta({ example: "New York" }),
                zipCode: z.string().meta({ example: "10001" }),
              }),
            }),
          }),
          output: z.object({ id: z.string() }),
          method: "POST",
          path: "/api/users",
          run: async ({ sendOutput }) => {
            return sendOutput({ id: "user-123" });
          },
        });

        const schema = (
          openAPIPathsObject["/api/users"]?.post?.requestBody as any
        )?.content?.["application/json"]?.schema;

        expect(schema.properties.user.properties.firstName.example).toBe(
          "John"
        );
        expect(schema.properties.user.properties.lastName.example).toBe("Doe");
        expect(
          schema.properties.user.properties.address.properties.city.example
        ).toBe("New York");
        expect(
          schema.properties.user.properties.address.properties.zipCode.example
        ).toBe("10001");
      });

      it("should include examples in arrays", () => {
        const { openAPIPathsObject } = makeRequestHandler({
          input: z.object({
            tags: z
              .array(z.string())
              .meta({ example: ["tech", "programming", "typescript"] }),
            scores: z.array(z.number()).meta({ example: [95, 87, 92] }),
          }),
          output: z.object({ success: z.boolean() }),
          method: "POST",
          path: "/api/data",
          run: async ({ sendOutput }) => {
            return sendOutput({ success: true });
          },
        });

        const schema = (
          openAPIPathsObject["/api/data"]?.post?.requestBody as any
        )?.content?.["application/json"]?.schema;

        expect(schema.properties.tags.example).toEqual([
          "tech",
          "programming",
          "typescript",
        ]);
        expect(schema.properties.scores.example).toEqual([95, 87, 92]);
      });

      it("should include examples and descriptions for enums", () => {
        const { openAPIPathsObject } = makeRequestHandler({
          input: z.object({
            status: z
              .enum(["active", "inactive", "pending"])
              .meta({
                example: "active",
                description: "User account status",
              }),
            role: z
              .enum(["admin", "user", "guest"])
              .meta({ example: "user", description: "User role" }),
          }),
          output: z.object({ success: z.boolean() }),
          method: "POST",
          path: "/api/users",
          run: async ({ sendOutput }) => {
            return sendOutput({ success: true });
          },
        });

        const schema = (
          openAPIPathsObject["/api/users"]?.post?.requestBody as any
        )?.content?.["application/json"]?.schema;

        expect(schema.properties.status).toMatchObject({
          type: "string",
          enum: ["active", "inactive", "pending"],
          example: "active",
          description: "User account status",
        });
        expect(schema.properties.role).toMatchObject({
          type: "string",
          enum: ["admin", "user", "guest"],
          example: "user",
          description: "User role",
        });
      });

      it("should include examples in response bodies", () => {
        const { openAPIPathsObject } = makeRequestHandler({
          input: z.object({ name: z.string() }),
          output: z.object({
            id: z.string().meta({
              example: "user-123",
              description: "Unique user identifier",
            }),
            name: z.string().meta({ example: "Alice" }),
            createdAt: z.string().meta({
              example: "2024-01-15T10:30:00Z",
              description: "ISO 8601 timestamp",
            }),
            stats: z.object({
              posts: z.number().meta({ example: 42 }),
              followers: z.number().meta({ example: 1337 }),
            }),
          }),
          method: "POST",
          path: "/api/users",
          run: async ({ sendOutput }) => {
            return sendOutput({
              id: "user-123",
              name: "Alice",
              createdAt: "2024-01-15T10:30:00Z",
              stats: { posts: 42, followers: 1337 },
            });
          },
        });

        const responseSchema = (
          openAPIPathsObject["/api/users"]?.post?.responses?.[200] as any
        )?.content?.["application/json"]?.schema;

        expect(responseSchema.properties.id).toMatchObject({
          type: "string",
          example: "user-123",
          description: "Unique user identifier",
        });
        expect(responseSchema.properties.name.example).toBe("Alice");
        expect(responseSchema.properties.createdAt).toMatchObject({
          type: "string",
          example: "2024-01-15T10:30:00Z",
          description: "ISO 8601 timestamp",
        });
        expect(responseSchema.properties.stats.properties.posts.example).toBe(
          42
        );
        expect(
          responseSchema.properties.stats.properties.followers.example
        ).toBe(1337);
      });

      it("should handle mixed example formats", () => {
        const { openAPIPathsObject } = makeRequestHandler({
          input: z.object({
            withExample: z.string().meta({ example: "value1" }),
            withDescription: z.string().meta({ description: "A description" }),
            withBoth: z
              .string()
              .meta({ example: "value2", description: "Both provided" }),
            withoutMeta: z.string(),
          }),
          output: z.object({ success: z.boolean() }),
          method: "POST",
          path: "/api/test",
          run: async ({ sendOutput }) => {
            return sendOutput({ success: true });
          },
        });

        const schema = (
          openAPIPathsObject["/api/test"]?.post?.requestBody as any
        )?.content?.["application/json"]?.schema;

        expect(schema.properties.withExample.example).toBe("value1");
        expect(schema.properties.withExample.description).toBeUndefined();

        expect(schema.properties.withDescription.example).toBeUndefined();
        expect(schema.properties.withDescription.description).toBe(
          "A description"
        );

        expect(schema.properties.withBoth).toMatchObject({
          example: "value2",
          description: "Both provided",
        });

        expect(schema.properties.withoutMeta.example).toBeUndefined();
        expect(schema.properties.withoutMeta.description).toBeUndefined();
      });
    });

    describe("query parameter schemas (baseline)", () => {
      it("should generate basic schema for query parameters", () => {
        const { openAPIPathsObject } = makeRequestHandler({
          input: z.object({
            search: z.string(),
            page: z.number(),
            limit: z.number().optional(),
          }),
          output: z.object({ results: z.array(z.string()) }),
          method: "GET",
          path: "/api/search",
          run: async ({ sendOutput }) => {
            return sendOutput({ results: [] });
          },
        });

        const parameters = openAPIPathsObject["/api/search"]?.get?.parameters;
        expect(parameters).toBeDefined();
        expect(parameters).toHaveLength(3);

        // Query parameters now get proper type schemas via createSchema()
        const searchParam = parameters?.find((p: any) => p.name === "search");
        expect(searchParam).toMatchObject({
          name: "search",
          in: "query",
          required: true,
          schema: { type: "string" },
        });

        const pageParam = parameters?.find((p: any) => p.name === "page");
        expect(pageParam).toMatchObject({
          name: "page",
          in: "query",
          required: true,
          schema: { type: "number" },
        });

        const limitParam = parameters?.find((p: any) => p.name === "limit");
        expect(limitParam).toMatchObject({
          name: "limit",
          in: "query",
          required: false,
          schema: { type: "number" },
        });
      });

      it("should handle query parameters with .meta()", () => {
        const { openAPIPathsObject } = makeRequestHandler({
          input: z.object({
            userId: z.string().meta({
              example: "user-123",
              description: "User ID to filter by",
            }),
            status: z.string().optional().meta({
              example: "active",
              description: "Filter by status",
            }),
          }),
          output: z.object({ data: z.array(z.any()) }),
          method: "GET",
          path: "/api/items",
          run: async ({ sendOutput }) => {
            return sendOutput({ data: [] });
          },
        });

        const parameters = openAPIPathsObject["/api/items"]?.get?.parameters;
        expect(parameters).toBeDefined();

        const userIdParam = parameters?.find((p: any) => p.name === "userId");
        expect(userIdParam).toMatchObject({
          name: "userId",
          in: "query",
          required: true,
          schema: {
            type: "string",
            example: "user-123",
            description: "User ID to filter by",
          },
        });

        const statusParam = parameters?.find((p: any) => p.name === "status");
        expect(statusParam).toMatchObject({
          name: "status",
          in: "query",
          required: false,
          schema: {
            type: "string",
            example: "active",
            description: "Filter by status",
          },
        });
      });

      it("should handle query parameters with different types and .meta()", () => {
        const { openAPIPathsObject } = makeRequestHandler({
          input: z.object({
            page: z.number().meta({ example: 1, description: "Page number" }),
            limit: z
              .number()
              .optional()
              .meta({ example: 10, description: "Items per page" }),
            verified: z
              .boolean()
              .meta({ example: true, description: "Filter verified users" }),
            tags: z
              .array(z.string())
              .optional()
              .meta({ example: ["tech", "science"] }),
          }),
          output: z.object({ data: z.array(z.any()) }),
          method: "GET",
          path: "/api/users",
          run: async ({ sendOutput }) => {
            return sendOutput({ data: [] });
          },
        });

        const parameters = openAPIPathsObject["/api/users"]?.get?.parameters;

        const pageParam = parameters?.find((p: any) => p.name === "page");
        expect(pageParam?.schema).toMatchObject({
          type: "number",
          example: 1,
          description: "Page number",
        });
        expect(pageParam?.required).toBe(true);

        const limitParam = parameters?.find((p: any) => p.name === "limit");
        expect(limitParam?.schema).toMatchObject({
          type: "number",
          example: 10,
          description: "Items per page",
        });
        expect(limitParam?.required).toBe(false);

        const verifiedParam = parameters?.find(
          (p: any) => p.name === "verified"
        );
        expect(verifiedParam?.schema).toMatchObject({
          type: "boolean",
          example: true,
          description: "Filter verified users",
        });

        const tagsParam = parameters?.find((p: any) => p.name === "tags");
        expect(tagsParam?.schema).toMatchObject({
          type: "array",
          example: ["tech", "science"],
        });
        expect(tagsParam?.required).toBe(false);
      });

      it("should handle query parameters with enums", () => {
        const { openAPIPathsObject } = makeRequestHandler({
          input: z.object({
            sort: z
              .enum(["asc", "desc"])
              .meta({ example: "asc", description: "Sort direction" }),
            status: z
              .enum(["active", "inactive", "pending"])
              .optional()
              .meta({ example: "active" }),
          }),
          output: z.object({ data: z.array(z.any()) }),
          method: "GET",
          path: "/api/items",
          run: async ({ sendOutput }) => {
            return sendOutput({ data: [] });
          },
        });

        const parameters = openAPIPathsObject["/api/items"]?.get?.parameters;

        const sortParam = parameters?.find((p: any) => p.name === "sort");
        expect(sortParam?.schema).toMatchObject({
          type: "string",
          enum: ["asc", "desc"],
          example: "asc",
          description: "Sort direction",
        });
        expect(sortParam?.required).toBe(true);

        const statusParam = parameters?.find((p: any) => p.name === "status");
        expect(statusParam?.schema).toMatchObject({
          type: "string",
          enum: ["active", "inactive", "pending"],
          example: "active",
        });
        expect(statusParam?.required).toBe(false);
      });
    });

    describe("path parameter schemas (baseline)", () => {
      it("should generate basic schema for path parameters", () => {
        const { openAPIPathsObject } = makeRequestHandler({
          input: z.object({
            userId: z.string(),
            postId: z.string(),
          }),
          output: z.object({ post: z.string() }),
          method: "GET",
          path: "/api/users/:userId/posts/:postId",
          run: async ({ sendOutput }) => {
            return sendOutput({ post: "test" });
          },
        });

        const parameters =
          openAPIPathsObject["/api/users/{userId}/posts/{postId}"]?.get
            ?.parameters;
        expect(parameters).toBeDefined();

        const userIdParam = parameters?.find((p: any) => p.name === "userId");
        expect(userIdParam).toMatchObject({
          name: "userId",
          in: "path",
          required: true,
          schema: { type: "string" },
        });

        const postIdParam = parameters?.find((p: any) => p.name === "postId");
        expect(postIdParam).toMatchObject({
          name: "postId",
          in: "path",
          required: true,
          schema: { type: "string" },
        });
      });

      it("should handle path parameters with .meta()", () => {
        const { openAPIPathsObject } = makeRequestHandler({
          input: z.object({
            userId: z.string().meta({
              example: "user-123",
              description: "Unique user identifier",
            }),
          }),
          output: z.object({ user: z.any() }),
          method: "GET",
          path: "/api/users/:userId",
          run: async ({ sendOutput }) => {
            return sendOutput({ user: {} });
          },
        });

        const parameters =
          openAPIPathsObject["/api/users/{userId}"]?.get?.parameters;
        const userIdParam = parameters?.find((p: any) => p.name === "userId");

        expect(userIdParam).toMatchObject({
          name: "userId",
          in: "path",
          required: true,
          schema: {
            type: "string",
            example: "user-123",
            description: "Unique user identifier",
          },
        });
      });

      it("should handle multiple path parameters with .meta()", () => {
        const { openAPIPathsObject } = makeRequestHandler({
          input: z.object({
            orgId: z.string().meta({
              example: "org-456",
              description: "Organization ID",
            }),
            userId: z.string().meta({
              example: "user-123",
              description: "User ID",
            }),
            postId: z.string().meta({
              example: "post-789",
              description: "Post ID",
            }),
          }),
          output: z.object({ post: z.any() }),
          method: "GET",
          path: "/api/orgs/:orgId/users/:userId/posts/:postId",
          run: async ({ sendOutput }) => {
            return sendOutput({ post: {} });
          },
        });

        const parameters =
          openAPIPathsObject["/api/orgs/{orgId}/users/{userId}/posts/{postId}"]
            ?.get?.parameters;

        const orgIdParam = parameters?.find((p: any) => p.name === "orgId");
        expect(orgIdParam).toMatchObject({
          name: "orgId",
          in: "path",
          required: true,
          schema: {
            type: "string",
            example: "org-456",
            description: "Organization ID",
          },
        });

        const userIdParam = parameters?.find((p: any) => p.name === "userId");
        expect(userIdParam).toMatchObject({
          name: "userId",
          in: "path",
          required: true,
          schema: {
            type: "string",
            example: "user-123",
            description: "User ID",
          },
        });

        const postIdParam = parameters?.find((p: any) => p.name === "postId");
        expect(postIdParam).toMatchObject({
          name: "postId",
          in: "path",
          required: true,
          schema: {
            type: "string",
            example: "post-789",
            description: "Post ID",
          },
        });
      });

      it("should handle path parameters with different string formats", () => {
        const { openAPIPathsObject } = makeRequestHandler({
          input: z.object({
            userId: z.string().uuid().meta({
              example: "550e8400-e29b-41d4-a716-446655440000",
              description: "User UUID",
            }),
            email: z.string().email().meta({
              example: "user@example.com",
              description: "User email",
            }),
          }),
          output: z.object({ user: z.any() }),
          method: "GET",
          path: "/api/users/:userId/email/:email",
          run: async ({ sendOutput }) => {
            return sendOutput({ user: {} });
          },
        });

        const parameters =
          openAPIPathsObject["/api/users/{userId}/email/{email}"]?.get
            ?.parameters;

        const userIdParam = parameters?.find((p: any) => p.name === "userId");
        expect(userIdParam?.schema).toMatchObject({
          type: "string",
          format: "uuid",
          example: "550e8400-e29b-41d4-a716-446655440000",
          description: "User UUID",
        });

        const emailParam = parameters?.find((p: any) => p.name === "email");
        expect(emailParam?.schema).toMatchObject({
          type: "string",
          format: "email",
          example: "user@example.com",
          description: "User email",
        });
      });
    });

    describe(".meta() edge cases", () => {
      it("should handle empty .meta({})", () => {
        const { openAPIPathsObject } = makeRequestHandler({
          input: z.object({
            name: z.string().meta({}),
          }),
          output: z.object({ success: z.boolean() }),
          method: "GET",
          path: "/api/test",
          run: async ({ sendOutput }) => {
            return sendOutput({ success: true });
          },
        });

        const parameters = openAPIPathsObject["/api/test"]?.get?.parameters;
        const nameParam = parameters?.find((p: any) => p.name === "name");
        expect(nameParam).toBeDefined();
        expect(nameParam?.schema.type).toBe("string");
      });

      it("should handle mixed path, query, and body parameters with .meta()", () => {
        const { openAPIPathsObject } = makeRequestHandler({
          input: z.object({
            userId: z.string().meta({
              example: "user-123",
              description: "User ID from path",
            }),
            filter: z.string().optional().meta({
              example: "active",
              description: "Query filter",
            }),
            data: z.object({
              name: z.string().meta({ example: "Alice" }),
              age: z.number().meta({ example: 30 }),
            }),
          }),
          output: z.object({ success: z.boolean() }),
          method: "POST",
          path: "/api/users/:userId",
          run: async ({ sendOutput }) => {
            return sendOutput({ success: true });
          },
        });

        const pathObj = openAPIPathsObject["/api/users/{userId}"]?.post;

        // Check path parameter
        const pathParams = pathObj?.parameters?.filter(
          (p: any) => p.in === "path"
        );
        expect(pathParams).toHaveLength(1);
        expect(pathParams?.[0]).toMatchObject({
          name: "userId",
          in: "path",
          schema: {
            type: "string",
            example: "user-123",
            description: "User ID from path",
          },
        });

        // Check request body
        const requestBodySchema = (pathObj?.requestBody as any)?.content?.[
          "application/json"
        ]?.schema;
        expect(requestBodySchema.properties.data.properties.name).toMatchObject(
          {
            type: "string",
            example: "Alice",
          }
        );
        expect(requestBodySchema.properties.data.properties.age).toMatchObject({
          type: "number",
          example: 30,
        });
      });

      it("should handle discriminated unions with examples", () => {
        const { openAPIPathsObject } = makeRequestHandler({
          input: z.discriminatedUnion("type", [
            z.object({
              type: z.literal("email").meta({ example: "email" }),
              email: z.string().email().meta({ example: "user@example.com" }),
            }),
            z.object({
              type: z.literal("sms").meta({ example: "sms" }),
              phone: z.string().meta({ example: "+1234567890" }),
            }),
          ]),
          output: z.object({ sent: z.boolean() }),
          method: "POST",
          path: "/api/notify",
          run: async ({ sendOutput }) => {
            return sendOutput({ sent: true });
          },
        });

        const requestBody =
          openAPIPathsObject["/api/notify"]?.post?.requestBody;
        expect(requestBody).toBeDefined();
        const schema = (requestBody as any)?.content?.["application/json"]
          ?.schema;

        // Discriminated unions should have oneOf with examples
        expect(schema.oneOf).toBeDefined();
        expect(schema.oneOf).toHaveLength(2);
      });

      it("should handle large example values", () => {
        const largeText = "a".repeat(1000);
        const largeArray = Array.from({ length: 100 }, (_, i) => i);

        const { openAPIPathsObject } = makeRequestHandler({
          input: z.object({
            content: z.string().meta({ example: largeText }),
            items: z.array(z.number()).meta({ example: largeArray }),
          }),
          output: z.object({ success: z.boolean() }),
          method: "POST",
          path: "/api/data",
          run: async ({ sendOutput }) => {
            return sendOutput({ success: true });
          },
        });

        const schema = (
          openAPIPathsObject["/api/data"]?.post?.requestBody as any
        )?.content?.["application/json"]?.schema;

        expect(schema.properties.content.example).toBe(largeText);
        expect(schema.properties.items.example).toEqual(largeArray);
      });

      it("should handle .meta() on optional fields in request bodies", () => {
        const { openAPIPathsObject } = makeRequestHandler({
          input: z.object({
            required: z.string().meta({ example: "value1" }),
            optional: z.string().optional().meta({ example: "value2" }),
            withDefault: z
              .string()
              .default("default")
              .meta({ example: "value3" }),
          }),
          output: z.object({ success: z.boolean() }),
          method: "POST",
          path: "/api/test",
          run: async ({ sendOutput }) => {
            return sendOutput({ success: true });
          },
        });

        const schema = (
          openAPIPathsObject["/api/test"]?.post?.requestBody as any
        )?.content?.["application/json"]?.schema;

        expect(schema.properties.required.example).toBe("value1");
        expect(schema.properties.optional.example).toBe("value2");
        expect(schema.properties.withDefault.example).toBe("value3");
        expect(schema.properties.withDefault.default).toBe("default");

        // Check required array
        expect(schema.required).toContain("required");
        expect(schema.required).not.toContain("optional");
      });

      it("should handle URL and date-time formats with examples", () => {
        const { openAPIPathsObject } = makeRequestHandler({
          input: z.object({
            website: z.string().url().meta({
              example: "https://example.com",
              description: "Website URL",
            }),
            createdAt: z.string().datetime().meta({
              example: "2024-01-15T10:30:00Z",
              description: "Creation timestamp",
            }),
          }),
          output: z.object({ success: z.boolean() }),
          method: "POST",
          path: "/api/resources",
          run: async ({ sendOutput }) => {
            return sendOutput({ success: true });
          },
        });

        const schema = (
          openAPIPathsObject["/api/resources"]?.post?.requestBody as any
        )?.content?.["application/json"]?.schema;

        expect(schema.properties.website).toMatchObject({
          type: "string",
          format: "uri",
          example: "https://example.com",
          description: "Website URL",
        });

        expect(schema.properties.createdAt).toMatchObject({
          type: "string",
          format: "date-time",
          example: "2024-01-15T10:30:00Z",
          description: "Creation timestamp",
        });
      });

      it("should handle coerced types in query parameters", () => {
        const { openAPIPathsObject } = makeRequestHandler({
          input: z.object({
            count: z.coerce.number().meta({
              example: 42,
              description: "Count value coerced from string",
            }),
            enabled: z.coerce.boolean().meta({
              example: true,
              description: "Boolean coerced from string",
            }),
          }),
          output: z.object({ data: z.array(z.any()) }),
          method: "GET",
          path: "/api/items",
          run: async ({ sendOutput }) => {
            return sendOutput({ data: [] });
          },
        });

        const parameters = openAPIPathsObject["/api/items"]?.get?.parameters;

        const countParam = parameters?.find((p: any) => p.name === "count");
        expect(countParam?.schema).toMatchObject({
          type: "number",
          example: 42,
          description: "Count value coerced from string",
        });

        const enabledParam = parameters?.find(
          (p: any) => p.name === "enabled"
        );
        expect(enabledParam?.schema).toMatchObject({
          type: "boolean",
          example: true,
          description: "Boolean coerced from string",
        });
      });
    });

    describe("integration: complete route with .meta() examples", () => {
      it("should handle examples across all parameter types (path, query, body, response)", () => {
        const { openAPIPathsObject } = makeRequestHandler({
          input: z.object({
            // Path parameter
            userId: z.string().meta({
              example: "user-abc123",
              description: "Unique identifier for the user",
            }),
            // Query parameters
            includeMetadata: z.boolean().optional().meta({
              example: true,
              description: "Include additional metadata in response",
            }),
            format: z.enum(["json", "xml"]).optional().meta({
              example: "json",
              description: "Response format",
            }),
            // Request body
            updateData: z.object({
              profile: z.object({
                displayName: z.string().meta({
                  example: "Alice Johnson",
                  description: "User's display name",
                }),
                bio: z.string().optional().meta({
                  example: "Software engineer and open source contributor",
                  description: "User biography",
                }),
                age: z.number().min(0).max(150).meta({
                  example: 28,
                  description: "User's age",
                }),
              }),
              preferences: z.object({
                theme: z
                  .enum(["light", "dark", "auto"])
                  .meta({ example: "dark", description: "UI theme preference" }),
                notifications: z
                  .boolean()
                  .meta({ example: true, description: "Enable notifications" }),
              }),
              tags: z.array(z.string()).meta({
                example: ["developer", "typescript", "react"],
                description: "User interest tags",
              }),
            }),
          }),
          output: z.object({
            success: z.boolean().meta({
              example: true,
              description: "Whether the update was successful",
            }),
            user: z.object({
              id: z.string().meta({ example: "user-abc123" }),
              displayName: z.string().meta({ example: "Alice Johnson" }),
              updatedAt: z.string().datetime().meta({
                example: "2024-01-15T14:30:00Z",
                description: "Timestamp of last update",
              }),
            }),
            metadata: z
              .object({
                version: z.number().meta({ example: 2 }),
                processingTime: z
                  .number()
                  .meta({ example: 45, description: "Processing time in ms" }),
              })
              .optional(),
          }),
          method: "PATCH",
          path: "/api/users/:userId",
          run: async ({ sendOutput }) => {
            return sendOutput({
              success: true,
              user: {
                id: "user-abc123",
                displayName: "Alice Johnson",
                updatedAt: "2024-01-15T14:30:00Z",
              },
            });
          },
        });

        const operation =
          openAPIPathsObject["/api/users/{userId}"]?.patch;
        expect(operation).toBeDefined();

        // Verify path parameter
        const pathParam = operation?.parameters?.find(
          (p: any) => p.name === "userId" && p.in === "path"
        );
        expect(pathParam).toMatchObject({
          name: "userId",
          in: "path",
          required: true,
          schema: {
            type: "string",
            example: "user-abc123",
            description: "Unique identifier for the user",
          },
        });

        // Verify query parameters are NOT present (PATCH method has request body)
        const queryParams = operation?.parameters?.filter(
          (p: any) => p.in === "query"
        );
        expect(queryParams).toHaveLength(0);

        // Verify request body with nested examples
        const requestBodySchema = (operation?.requestBody as any)?.content?.[
          "application/json"
        ]?.schema;
        expect(requestBodySchema).toBeDefined();

        // Check nested profile fields
        expect(
          requestBodySchema.properties.updateData.properties.profile.properties
            .displayName
        ).toMatchObject({
          type: "string",
          example: "Alice Johnson",
          description: "User's display name",
        });

        expect(
          requestBodySchema.properties.updateData.properties.profile.properties
            .bio
        ).toMatchObject({
          type: "string",
          example: "Software engineer and open source contributor",
          description: "User biography",
        });

        expect(
          requestBodySchema.properties.updateData.properties.profile.properties
            .age
        ).toMatchObject({
          type: "number",
          minimum: 0,
          maximum: 150,
          example: 28,
          description: "User's age",
        });

        // Check preferences
        expect(
          requestBodySchema.properties.updateData.properties.preferences
            .properties.theme
        ).toMatchObject({
          type: "string",
          enum: ["light", "dark", "auto"],
          example: "dark",
          description: "UI theme preference",
        });

        // Check array with example
        expect(
          requestBodySchema.properties.updateData.properties.tags
        ).toMatchObject({
          type: "array",
          example: ["developer", "typescript", "react"],
          description: "User interest tags",
        });

        // Verify response body with examples
        const responseSchema = (operation?.responses?.[200] as any)?.content?.[
          "application/json"
        ]?.schema;
        expect(responseSchema).toBeDefined();

        expect(responseSchema.properties.success).toMatchObject({
          type: "boolean",
          example: true,
          description: "Whether the update was successful",
        });

        expect(responseSchema.properties.user.properties.id).toMatchObject({
          type: "string",
          example: "user-abc123",
        });

        expect(
          responseSchema.properties.user.properties.displayName
        ).toMatchObject({
          type: "string",
          example: "Alice Johnson",
        });

        expect(
          responseSchema.properties.user.properties.updatedAt
        ).toMatchObject({
          type: "string",
          format: "date-time",
          example: "2024-01-15T14:30:00Z",
          description: "Timestamp of last update",
        });

        expect(
          responseSchema.properties.metadata.properties.processingTime
        ).toMatchObject({
          type: "number",
          example: 45,
          description: "Processing time in ms",
        });
      });
    });
  });

  it("should return 400 for missing required fields", async () => {
    const { handler } = makeRequestHandler({
      input: z.object({ name: z.string(), age: z.number() }),
      output: z.object({ greeting: z.string() }),
      method: "GET",
      path: "/api/hello",
      run: async ({ input, sendOutput }) => {
        return sendOutput({ greeting: `Hello, ${input.name}!` });
      },
    });

    const response = await handler(
      new Request("http://test.com/api/hello?name=test")
    );

    expect(response.status).toBe(400);
  });

  it("should return 400 for invalid data types", async () => {
    const { handler } = makeRequestHandler({
      input: z.object({ name: z.string(), age: z.number() }),
      output: z.object({ greeting: z.string() }),
      method: "GET",
      path: "/api/hello",
      run: async ({ input, sendOutput }) => {
        return sendOutput({ greeting: `Hello, ${input.name}!` });
      },
    });

    const response = await handler(
      new Request("http://test.com/api/hello?name=test&age=not-a-number")
    );

    expect(response.status).toBe(400);
  });
});

describe("handler wrapper pattern", () => {
  // Minimal wrapper that injects a user object
  const withUser = <
    TInput extends z.ZodObject<any, any>,
    TOutput extends z.ZodObject<any, any>
  >(props: {
    input: TInput;
    output: TOutput;
    run: (args: {
      input: z.infer<TInput>;
      sendOutput: (output: z.infer<TOutput>) => Promise<Response>;
      user: { id: string }; // Extra prop injected by wrapper
    }) => Promise<Response>;
  }) => {
    return makeRequestHandler({
      input: props.input,
      output: props.output,
      method: "GET",
      path: "/test",
      run: async ({ input, sendOutput }) => {
        const user = { id: "user-123" }; // Injected by wrapper
        return props.run({ input, sendOutput, user });
      },
    });
  };

  it("should work with wrapper that injects additional props", async () => {
    const { handler } = withUser({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string(), userId: z.string() }),
      run: async ({ input, sendOutput, user }) => {
        return sendOutput({
          greeting: `Hello, ${input.name}!`,
          userId: user.id,
        });
      },
    });

    const response = await handler(
      new Request("http://test.com/test?name=John")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ greeting: "Hello, John!", userId: "user-123" });
  });

  it("should work with .strict() schemas", async () => {
    const { handler } = withUser({
      input: z.object({ name: z.string() }).strict(),
      output: z.object({ message: z.string() }).strict(),
      run: async ({ input, sendOutput }) => {
        return sendOutput({ message: `Hi ${input.name}` });
      },
    });

    const response = await handler(
      new Request("http://test.com/test?name=Jane")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe("Hi Jane");
  });
});
