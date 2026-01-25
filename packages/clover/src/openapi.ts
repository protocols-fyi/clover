import type { oas31 } from "openapi3-ts";
import type { z } from "zod";
import { createSchema } from "zod-openapi";
import { commonReponses } from "./responses";
import {
  getKeysFromPathPattern,
  type HTTPMethod,
  httpMethodSupportsRequestBody,
  toOpenAPIPath,
} from "./utils";

function jsonContent(schema: z.ZodTypeAny): oas31.MediaTypeObject {
  return { schema: createSchema(schema).schema };
}

function buildQueryParameters(
  input: z.ZodObject<any, any>,
  pathKeyNames: Set<string>
): oas31.ParameterObject[] {
  return Object.keys(input.shape)
    .filter((key) => !pathKeyNames.has(key))
    .map((key) => {
      const fieldSchema = input.shape[key];
      return {
        name: key,
        in: "query" as const,
        required: !(fieldSchema.isOptional?.() ?? false),
        schema: createSchema(fieldSchema).schema,
      };
    });
}

function buildPathParameters(
  input: z.ZodObject<any, any>,
  pathKeys: { name: string | number }[]
): oas31.ParameterObject[] {
  return pathKeys.map((key) => ({
    name: String(key.name),
    in: "path" as const,
    required: true,
    schema: createSchema(input.shape[key.name]).schema,
  }));
}

export interface BuildOpenAPIPathsObjectParams {
  input: z.ZodObject<any, any>;
  output: z.ZodObject<any, any>;
  method: HTTPMethod;
  path: string;
  description?: string;
  tags?: string[];
  requiresAuth: boolean;
}

export function buildOpenAPIPathsObject(
  params: BuildOpenAPIPathsObjectParams
): oas31.PathsObject {
  const { input, output, method, path, description, tags, requiresAuth } =
    params;

  const pathKeys = getKeysFromPathPattern(path);
  const pathKeyNames = new Set(pathKeys.map((k) => String(k.name)));

  const parameters = httpMethodSupportsRequestBody[method]
    ? buildPathParameters(input, pathKeys)
    : [
        ...buildQueryParameters(input, pathKeyNames),
        ...buildPathParameters(input, pathKeys),
      ];

  const requestBody: oas31.RequestBodyObject | undefined =
    httpMethodSupportsRequestBody[method]
      ? { content: { "application/json": jsonContent(input) } }
      : undefined;

  const operation: oas31.OperationObject = {
    description,
    parameters,
    requestBody,
    responses: {
      200: {
        description: "Success",
        content: { "application/json": jsonContent(output) },
      },
      400: commonReponses[400].openAPISchema,
      401: requiresAuth ? commonReponses[401].openAPISchema : undefined,
    },
    tags,
  };

  return {
    [toOpenAPIPath(path)]: {
      [method.toLowerCase()]: operation,
    },
  };
}
