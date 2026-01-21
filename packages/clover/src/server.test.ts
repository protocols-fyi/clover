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

        // Currently, all query parameters get basic string schemas
        const searchParam = parameters?.find((p: any) => p.name === "search");
        expect(searchParam).toMatchObject({
          name: "search",
          in: "query",
          schema: { type: "string" },
        });

        const pageParam = parameters?.find((p: any) => p.name === "page");
        expect(pageParam).toMatchObject({
          name: "page",
          in: "query",
          schema: { type: "string" },
        });

        const limitParam = parameters?.find((p: any) => p.name === "limit");
        expect(limitParam).toMatchObject({
          name: "limit",
          in: "query",
          schema: { type: "string" },
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

        // Currently, .meta() on query params is ignored (will be fixed)
        const userIdParam = parameters?.find((p: any) => p.name === "userId");
        expect(userIdParam).toMatchObject({
          name: "userId",
          in: "query",
          schema: { type: "string" },
        });
        // These should exist after enhancement:
        // expect(userIdParam.schema.example).toBe("user-123");
        // expect(userIdParam.schema.description).toBe("User ID to filter by");
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
          schema: { type: "string" },
        });
        // These should exist after enhancement:
        // expect(userIdParam.schema.example).toBe("user-123");
        // expect(userIdParam.schema.description).toBe("Unique user identifier");
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
