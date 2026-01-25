import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildOpenAPIPathsObject } from "./openapi";

describe("buildOpenAPIPathsObject", () => {
  it("should generate correct OpenAPI schema for GET with query params", () => {
    const result = buildOpenAPIPathsObject({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: "GET",
      path: "/api/hello",
      requiresAuth: false,
    });

    expect(result).toEqual({
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

  it("should generate correct OpenAPI schema for POST with request body", () => {
    const result = buildOpenAPIPathsObject({
      input: z.object({ name: z.string(), email: z.string() }),
      output: z.object({ id: z.string() }),
      method: "POST",
      path: "/api/users",
      requiresAuth: false,
    });

    expect(result["/api/users"]?.post?.requestBody).toEqual({
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              email: { type: "string" },
            },
            required: ["name", "email"],
            additionalProperties: false,
          },
        },
      },
    });
    // POST should not have query parameters
    expect(result["/api/users"]?.post?.parameters).toEqual([]);
  });

  it("should convert Express-style path params to OpenAPI format", () => {
    const result = buildOpenAPIPathsObject({
      input: z.object({ userId: z.string(), postId: z.string() }),
      output: z.object({ post: z.string() }),
      method: "GET",
      path: "/api/users/:userId/posts/:postId",
      requiresAuth: false,
    });

    expect(Object.keys(result)).toEqual(["/api/users/{userId}/posts/{postId}"]);
  });

  it("should include path parameters in parameters array", () => {
    const result = buildOpenAPIPathsObject({
      input: z.object({ userId: z.string() }),
      output: z.object({ user: z.string() }),
      method: "GET",
      path: "/api/users/:userId",
      requiresAuth: false,
    });

    const parameters = result["/api/users/{userId}"]?.get?.parameters;
    expect(parameters).toContainEqual({
      name: "userId",
      in: "path",
      required: true,
      schema: { type: "string" },
    });
  });

  it("should separate path params from query params for GET requests", () => {
    const result = buildOpenAPIPathsObject({
      input: z.object({
        userId: z.string(),
        includeDetails: z.boolean().optional(),
      }),
      output: z.object({ user: z.string() }),
      method: "GET",
      path: "/api/users/:userId",
      requiresAuth: false,
    });

    const parameters = result["/api/users/{userId}"]?.get?.parameters;

    // Should have both path and query params
    expect(parameters).toContainEqual({
      name: "userId",
      in: "path",
      required: true,
      schema: { type: "string" },
    });
    expect(parameters).toContainEqual({
      name: "includeDetails",
      in: "query",
      required: false,
      schema: { type: "boolean" },
    });
  });

  it("should only include path params for POST requests (not query)", () => {
    const result = buildOpenAPIPathsObject({
      input: z.object({
        userId: z.string(),
        name: z.string(),
      }),
      output: z.object({ success: z.boolean() }),
      method: "POST",
      path: "/api/users/:userId",
      requiresAuth: false,
    });

    const pathObj = result["/api/users/{userId}"]?.post;

    // Path param should be in parameters
    expect(pathObj?.parameters).toContainEqual({
      name: "userId",
      in: "path",
      required: true,
      schema: { type: "string" },
    });

    // name should be in request body, not parameters
    expect(pathObj?.parameters).not.toContainEqual(
      expect.objectContaining({ name: "name" })
    );
    expect(
      (pathObj?.requestBody as any)?.content["application/json"]?.schema
        ?.properties?.name
    ).toBeDefined();
  });

  it("should include 401 response when requiresAuth is true", () => {
    const result = buildOpenAPIPathsObject({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: "GET",
      path: "/api/hello",
      requiresAuth: true,
    });

    expect(result["/api/hello"]?.get?.responses?.[401]).toBeDefined();
  });

  it("should not include 401 response when requiresAuth is false", () => {
    const result = buildOpenAPIPathsObject({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: "GET",
      path: "/api/hello",
      requiresAuth: false,
    });

    expect(result["/api/hello"]?.get?.responses?.[401]).toBeUndefined();
  });

  it("should include description when provided", () => {
    const result = buildOpenAPIPathsObject({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: "GET",
      path: "/api/hello",
      description: "Get a greeting message",
      requiresAuth: false,
    });

    expect(result["/api/hello"]?.get?.description).toBe(
      "Get a greeting message"
    );
  });

  it("should include tags when provided", () => {
    const result = buildOpenAPIPathsObject({
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
      method: "GET",
      path: "/api/hello",
      tags: ["greetings", "public"],
      requiresAuth: false,
    });

    expect(result["/api/hello"]?.get?.tags).toEqual(["greetings", "public"]);
  });

  it("should mark optional query params as not required", () => {
    const result = buildOpenAPIPathsObject({
      input: z.object({
        required: z.string(),
        optional: z.string().optional(),
      }),
      output: z.object({ result: z.string() }),
      method: "GET",
      path: "/api/test",
      requiresAuth: false,
    });

    const parameters = result["/api/test"]?.get?.parameters;

    expect(parameters).toContainEqual({
      name: "required",
      in: "query",
      required: true,
      schema: { type: "string" },
    });
    expect(parameters).toContainEqual({
      name: "optional",
      in: "query",
      required: false,
      schema: { type: "string" },
    });
  });

  describe(".meta() examples support", () => {
    it("should include example and description in request body fields", () => {
      const result = buildOpenAPIPathsObject({
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
        requiresAuth: false,
      });

      const schema = (result["/api/users"]?.post?.requestBody as any)
        ?.content?.["application/json"]?.schema;

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

    it("should include examples in response body", () => {
      const result = buildOpenAPIPathsObject({
        input: z.object({ id: z.string() }),
        output: z.object({
          name: z.string().meta({ example: "John Doe" }),
          email: z.string().meta({ example: "john@example.com" }),
        }),
        method: "POST",
        path: "/api/users",
        requiresAuth: false,
      });

      const schema = (result["/api/users"]?.post?.responses?.[200] as any)
        ?.content?.["application/json"]?.schema;

      expect(schema.properties.name.example).toBe("John Doe");
      expect(schema.properties.email.example).toBe("john@example.com");
    });
  });

  describe("HTTP methods", () => {
    it.each([
      "PUT",
      "PATCH",
    ] as const)("should use request body for %s method", (method) => {
      const result = buildOpenAPIPathsObject({
        input: z.object({ data: z.string() }),
        output: z.object({ success: z.boolean() }),
        method,
        path: "/api/resource",
        requiresAuth: false,
      });

      const operation =
        result["/api/resource"]?.[
          method.toLowerCase() as Lowercase<typeof method>
        ];
      expect(operation?.requestBody).toBeDefined();
    });

    it("should use query params for DELETE method (no request body)", () => {
      const result = buildOpenAPIPathsObject({
        input: z.object({ id: z.string() }),
        output: z.object({ success: z.boolean() }),
        method: "DELETE",
        path: "/api/resource",
        requiresAuth: false,
      });

      const operation = result["/api/resource"]?.delete;
      expect(operation?.requestBody).toBeUndefined();
      expect(operation?.parameters).toContainEqual({
        name: "id",
        in: "query",
        required: true,
        schema: { type: "string" },
      });
    });

    it("should use query params for GET method (no request body)", () => {
      const result = buildOpenAPIPathsObject({
        input: z.object({ search: z.string() }),
        output: z.object({ results: z.array(z.string()) }),
        method: "GET",
        path: "/api/search",
        requiresAuth: false,
      });

      const operation = result["/api/search"]?.get;
      expect(operation?.requestBody).toBeUndefined();
      expect(operation?.parameters).toContainEqual({
        name: "search",
        in: "query",
        required: true,
        schema: { type: "string" },
      });
    });
  });

  describe("complex schemas", () => {
    it("should handle nested objects", () => {
      const result = buildOpenAPIPathsObject({
        input: z.object({
          user: z.object({
            name: z.string(),
            address: z.object({
              city: z.string(),
              zip: z.string(),
            }),
          }),
        }),
        output: z.object({ id: z.string() }),
        method: "POST",
        path: "/api/users",
        requiresAuth: false,
      });

      const schema = (result["/api/users"]?.post?.requestBody as any)
        ?.content?.["application/json"]?.schema;

      expect(schema.properties.user.properties.address.properties.city).toEqual(
        {
          type: "string",
        }
      );
    });

    it("should handle arrays", () => {
      const result = buildOpenAPIPathsObject({
        input: z.object({
          tags: z.array(z.string()),
        }),
        output: z.object({ count: z.number() }),
        method: "POST",
        path: "/api/items",
        requiresAuth: false,
      });

      const schema = (result["/api/items"]?.post?.requestBody as any)
        ?.content?.["application/json"]?.schema;

      expect(schema.properties.tags).toEqual({
        type: "array",
        items: { type: "string" },
      });
    });

    it("should handle enums", () => {
      const result = buildOpenAPIPathsObject({
        input: z.object({
          status: z.enum(["active", "inactive", "pending"]),
        }),
        output: z.object({ updated: z.boolean() }),
        method: "POST",
        path: "/api/status",
        requiresAuth: false,
      });

      const schema = (result["/api/status"]?.post?.requestBody as any)
        ?.content?.["application/json"]?.schema;

      expect(schema.properties.status.enum).toEqual([
        "active",
        "inactive",
        "pending",
      ]);
    });

    it("should handle unions", () => {
      const result = buildOpenAPIPathsObject({
        input: z.object({
          value: z.union([z.string(), z.number()]),
        }),
        output: z.object({ received: z.boolean() }),
        method: "POST",
        path: "/api/union",
        requiresAuth: false,
      });

      const schema = (result["/api/union"]?.post?.requestBody as any)
        ?.content?.["application/json"]?.schema;

      expect(schema.properties.value.anyOf).toBeDefined();
    });

    it("should handle nullable fields", () => {
      const result = buildOpenAPIPathsObject({
        input: z.object({
          name: z.string().nullable(),
        }),
        output: z.object({ success: z.boolean() }),
        method: "POST",
        path: "/api/nullable",
        requiresAuth: false,
      });

      const schema = (result["/api/nullable"]?.post?.requestBody as any)
        ?.content?.["application/json"]?.schema;

      // Nullable fields should allow null
      expect(
        schema.properties.name.anyOf || schema.properties.name.type
      ).toBeDefined();
    });

    it("should handle default values", () => {
      const result = buildOpenAPIPathsObject({
        input: z.object({
          count: z.number().default(10),
        }),
        output: z.object({ result: z.number() }),
        method: "POST",
        path: "/api/defaults",
        requiresAuth: false,
      });

      const schema = (result["/api/defaults"]?.post?.requestBody as any)
        ?.content?.["application/json"]?.schema;

      expect(schema.properties.count.default).toBe(10);
    });

    it("should handle literal types", () => {
      const result = buildOpenAPIPathsObject({
        input: z.object({
          type: z.literal("fixed"),
        }),
        output: z.object({ success: z.boolean() }),
        method: "POST",
        path: "/api/literal",
        requiresAuth: false,
      });

      const schema = (result["/api/literal"]?.post?.requestBody as any)
        ?.content?.["application/json"]?.schema;

      expect(schema.properties.type.const).toBe("fixed");
    });

    it("should handle records/maps", () => {
      const result = buildOpenAPIPathsObject({
        input: z.object({
          metadata: z.record(z.string(), z.any()),
        }),
        output: z.object({ stored: z.boolean() }),
        method: "POST",
        path: "/api/record",
        requiresAuth: false,
      });

      const schema = (result["/api/record"]?.post?.requestBody as any)
        ?.content?.["application/json"]?.schema;

      expect(schema.properties.metadata.type).toBe("object");
      expect(schema.properties.metadata.additionalProperties).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("should handle empty input schema", () => {
      const result = buildOpenAPIPathsObject({
        input: z.object({}),
        output: z.object({ time: z.string() }),
        method: "GET",
        path: "/api/time",
        requiresAuth: false,
      });

      expect(result["/api/time"]?.get?.parameters).toEqual([]);
    });

    it("should handle empty output schema", () => {
      const result = buildOpenAPIPathsObject({
        input: z.object({ id: z.string() }),
        output: z.object({}),
        method: "DELETE",
        path: "/api/items/:id",
        requiresAuth: false,
      });

      const responseSchema = (
        result["/api/items/{id}"]?.delete?.responses?.[200] as any
      )?.content?.["application/json"]?.schema;

      expect(responseSchema.properties).toEqual({});
    });

    it("should handle path with only path params (no query or body fields)", () => {
      const result = buildOpenAPIPathsObject({
        input: z.object({ id: z.string() }),
        output: z.object({ found: z.boolean() }),
        method: "GET",
        path: "/api/items/:id",
        requiresAuth: false,
      });

      const parameters = result["/api/items/{id}"]?.get?.parameters;
      expect(parameters).toHaveLength(1);
      expect(parameters?.[0]).toMatchObject({
        name: "id",
        in: "path",
      });
    });

    it("should handle multiple path params", () => {
      const result = buildOpenAPIPathsObject({
        input: z.object({
          orgId: z.string(),
          teamId: z.string(),
          userId: z.string(),
        }),
        output: z.object({ member: z.string() }),
        method: "GET",
        path: "/api/orgs/:orgId/teams/:teamId/users/:userId",
        requiresAuth: false,
      });

      const parameters =
        result["/api/orgs/{orgId}/teams/{teamId}/users/{userId}"]?.get
          ?.parameters;

      expect(parameters).toHaveLength(3);
      expect(parameters?.filter((p: any) => p.in === "path")).toHaveLength(3);
    });

    it("should handle path params with numbers in name", () => {
      const result = buildOpenAPIPathsObject({
        input: z.object({ id1: z.string(), id2: z.string() }),
        output: z.object({ result: z.string() }),
        method: "GET",
        path: "/api/compare/:id1/:id2",
        requiresAuth: false,
      });

      expect(Object.keys(result)).toEqual(["/api/compare/{id1}/{id2}"]);
    });

    it("should handle numeric path params", () => {
      const result = buildOpenAPIPathsObject({
        input: z.object({ id: z.coerce.number() }),
        output: z.object({ item: z.string() }),
        method: "GET",
        path: "/api/items/:id",
        requiresAuth: false,
      });

      const parameters = result["/api/items/{id}"]?.get?.parameters;
      const idParam = parameters?.find((p: any) => p.name === "id") as any;

      expect(idParam?.schema?.type).toBe("number");
    });

    it("should handle all input as optional query params", () => {
      const result = buildOpenAPIPathsObject({
        input: z.object({
          page: z.number().optional(),
          limit: z.number().optional(),
          sort: z.string().optional(),
        }),
        output: z.object({ items: z.array(z.string()) }),
        method: "GET",
        path: "/api/items",
        requiresAuth: false,
      });

      const parameters = result["/api/items"]?.get?.parameters;

      expect(parameters).toHaveLength(3);
      expect(parameters?.every((p: any) => p.required === false)).toBe(true);
    });

    it("should handle mixed required and optional query params", () => {
      const result = buildOpenAPIPathsObject({
        input: z.object({
          search: z.string(),
          page: z.number().optional(),
          limit: z.number().optional(),
        }),
        output: z.object({ results: z.array(z.string()) }),
        method: "GET",
        path: "/api/search",
        requiresAuth: false,
      });

      const parameters = result["/api/search"]?.get?.parameters;
      const searchParam = parameters?.find(
        (p: any) => p.name === "search"
      ) as any;
      const pageParam = parameters?.find((p: any) => p.name === "page") as any;

      expect(searchParam?.required).toBe(true);
      expect(pageParam?.required).toBe(false);
    });

    it("should handle root path", () => {
      const result = buildOpenAPIPathsObject({
        input: z.object({}),
        output: z.object({ status: z.string() }),
        method: "GET",
        path: "/",
        requiresAuth: false,
      });

      expect(Object.keys(result)).toEqual(["/"]);
    });

    it("should handle path with trailing slash", () => {
      const result = buildOpenAPIPathsObject({
        input: z.object({}),
        output: z.object({ status: z.string() }),
        method: "GET",
        path: "/api/health/",
        requiresAuth: false,
      });

      // Should preserve trailing slash
      expect(Object.keys(result)[0]).toBe("/api/health/");
    });

    it("should handle deeply nested path", () => {
      const result = buildOpenAPIPathsObject({
        input: z.object({
          a: z.string(),
          b: z.string(),
          c: z.string(),
          d: z.string(),
        }),
        output: z.object({ deep: z.boolean() }),
        method: "GET",
        path: "/api/:a/level1/:b/level2/:c/level3/:d",
        requiresAuth: false,
      });

      expect(Object.keys(result)).toEqual([
        "/api/{a}/level1/{b}/level2/{c}/level3/{d}",
      ]);
    });
  });

  describe("special characters and edge cases in values", () => {
    it("should handle description with special characters", () => {
      const result = buildOpenAPIPathsObject({
        input: z.object({ query: z.string() }),
        output: z.object({ results: z.array(z.string()) }),
        method: "GET",
        path: "/api/search",
        description:
          'Search endpoint - supports "quoted" strings & special <chars>',
        requiresAuth: false,
      });

      expect(result["/api/search"]?.get?.description).toBe(
        'Search endpoint - supports "quoted" strings & special <chars>'
      );
    });

    it("should handle empty tags array", () => {
      const result = buildOpenAPIPathsObject({
        input: z.object({ id: z.string() }),
        output: z.object({ item: z.string() }),
        method: "GET",
        path: "/api/items/:id",
        tags: [],
        requiresAuth: false,
      });

      expect(result["/api/items/{id}"]?.get?.tags).toEqual([]);
    });

    it("should handle very long path", () => {
      const longPath = `/api${"/segment".repeat(20)}/:id`;
      const result = buildOpenAPIPathsObject({
        input: z.object({ id: z.string() }),
        output: z.object({ found: z.boolean() }),
        method: "GET",
        path: longPath,
        requiresAuth: false,
      });

      const expectedPath = `/api${"/segment".repeat(20)}/{id}`;
      expect(Object.keys(result)).toEqual([expectedPath]);
    });
  });

  describe("type coercion scenarios", () => {
    it("should handle coerced boolean in query params", () => {
      const result = buildOpenAPIPathsObject({
        input: z.object({
          active: z.coerce.boolean(),
        }),
        output: z.object({ items: z.array(z.string()) }),
        method: "GET",
        path: "/api/items",
        requiresAuth: false,
      });

      const parameters = result["/api/items"]?.get?.parameters;
      const activeParam = parameters?.find(
        (p: any) => p.name === "active"
      ) as any;

      expect(activeParam?.schema?.type).toBe("boolean");
    });

    it("should handle string format constraints", () => {
      const result = buildOpenAPIPathsObject({
        input: z.object({
          email: z.email(),
          url: z.url(),
          uuid: z.uuid(),
        }),
        output: z.object({ valid: z.boolean() }),
        method: "POST",
        path: "/api/validate",
        requiresAuth: false,
      });

      const schema = (result["/api/validate"]?.post?.requestBody as any)
        ?.content?.["application/json"]?.schema;

      expect(schema.properties.email.format).toBe("email");
      expect(schema.properties.url.format).toBe("uri");
      expect(schema.properties.uuid.format).toBe("uuid");
    });

    it("should handle number constraints", () => {
      const result = buildOpenAPIPathsObject({
        input: z.object({
          age: z.number().int().min(0).max(150),
          price: z.number().positive(),
        }),
        output: z.object({ valid: z.boolean() }),
        method: "POST",
        path: "/api/validate",
        requiresAuth: false,
      });

      const schema = (result["/api/validate"]?.post?.requestBody as any)
        ?.content?.["application/json"]?.schema;

      expect(schema.properties.age.type).toBe("integer");
      expect(schema.properties.age.minimum).toBe(0);
      expect(schema.properties.age.maximum).toBe(150);
      expect(schema.properties.price.exclusiveMinimum).toBe(0);
    });

    it("should handle array constraints", () => {
      const result = buildOpenAPIPathsObject({
        input: z.object({
          tags: z.array(z.string()).min(1).max(10),
        }),
        output: z.object({ stored: z.boolean() }),
        method: "POST",
        path: "/api/tags",
        requiresAuth: false,
      });

      const schema = (result["/api/tags"]?.post?.requestBody as any)?.content?.[
        "application/json"
      ]?.schema;

      expect(schema.properties.tags.minItems).toBe(1);
      expect(schema.properties.tags.maxItems).toBe(10);
    });

    it("should handle string length constraints", () => {
      const result = buildOpenAPIPathsObject({
        input: z.object({
          username: z.string().min(3).max(20),
          bio: z.string().length(100),
        }),
        output: z.object({ created: z.boolean() }),
        method: "POST",
        path: "/api/profile",
        requiresAuth: false,
      });

      const schema = (result["/api/profile"]?.post?.requestBody as any)
        ?.content?.["application/json"]?.schema;

      expect(schema.properties.username.minLength).toBe(3);
      expect(schema.properties.username.maxLength).toBe(20);
      expect(schema.properties.bio.minLength).toBe(100);
      expect(schema.properties.bio.maxLength).toBe(100);
    });
  });
});
