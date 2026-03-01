import { bench, describe } from "vitest";
import { z } from "zod";
import { makeRequestHandler } from "./server";

/**
 * Performance benchmarks measuring the cost of Zod parsing
 * in clover route handlers.
 *
 * Run with: vitest bench src/server.perf.test.ts
 */

const noopResponse = new Response(null, { status: 204 });

// -- Schemas of varying complexity --

const simpleSchema = z.object({
  name: z.string(),
});

const mediumSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number().int().min(0).max(150),
  active: z.boolean(),
  role: z.enum(["admin", "user", "moderator"]),
});

const complexSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().min(0).max(150),
  active: z.boolean(),
  role: z.enum(["admin", "user", "moderator"]),
  tags: z.array(z.string()).max(10),
  address: z.object({
    street: z.string(),
    city: z.string(),
    zip: z.string().regex(/^\d{5}$/),
    country: z.string().length(2),
  }),
  preferences: z.object({
    theme: z.enum(["light", "dark"]),
    notifications: z.boolean(),
    language: z.string().default("en"),
  }),
});

const dummyOutput = z.object({ ok: z.boolean() });

// -- Handlers --

const simpleHandler = makeRequestHandler({
  input: simpleSchema,
  output: dummyOutput,
  method: "POST",
  path: "/bench/simple",
  run: async () => noopResponse,
}).handler;

const mediumHandler = makeRequestHandler({
  input: mediumSchema,
  output: dummyOutput,
  method: "POST",
  path: "/bench/medium",
  run: async () => noopResponse,
}).handler;

const complexHandler = makeRequestHandler({
  input: complexSchema,
  output: dummyOutput,
  method: "POST",
  path: "/bench/complex",
  run: async () => noopResponse,
}).handler;

// -- Baseline: direct run callback with no framework overhead --

function makeRawZodBenchmark(schema: z.ZodObject<any>) {
  return async (data: Record<string, unknown>) => {
    schema.safeParse(data);
  };
}

const simpleData = { name: "Alice" };
const mediumData = {
  name: "Alice",
  email: "alice@example.com",
  age: 30,
  active: true,
  role: "admin",
};
const complexData = {
  name: "Alice",
  email: "alice@example.com",
  age: 30,
  active: true,
  role: "admin",
  tags: ["a", "b", "c"],
  address: { street: "123 Main St", city: "Springfield", zip: "12345", country: "US" },
  preferences: { theme: "dark", notifications: true, language: "en" },
};

function postRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// -- Benchmarks --

describe("Zod parsing cost: raw safeParse baseline", () => {
  const parseSimple = makeRawZodBenchmark(simpleSchema);
  const parseMedium = makeRawZodBenchmark(mediumSchema);
  const parseComplex = makeRawZodBenchmark(complexSchema);

  bench("simple schema (1 field)", () => parseSimple(simpleData));
  bench("medium schema (5 fields)", () => parseMedium(mediumData));
  bench("complex schema (nested, 10+ fields)", () => parseComplex(complexData));
});

describe("Full handler (Request → Response)", () => {
  bench("simple schema (1 field)", async () => {
    await simpleHandler(postRequest("http://localhost/bench/simple", simpleData));
  });

  bench("medium schema (5 fields)", async () => {
    await mediumHandler(postRequest("http://localhost/bench/medium", mediumData));
  });

  bench("complex schema (nested, 10+ fields)", async () => {
    await complexHandler(postRequest("http://localhost/bench/complex", complexData));
  });
});

describe("Handler without Zod (no-input baseline)", () => {
  const noInputHandler = makeRequestHandler({
    input: z.object({}),
    output: dummyOutput,
    method: "POST",
    path: "/bench/noinput",
    run: async () => noopResponse,
  }).handler;

  bench("empty schema handler", async () => {
    await noInputHandler(
      postRequest("http://localhost/bench/noinput", {}),
    );
  });
});
