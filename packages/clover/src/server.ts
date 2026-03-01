import merge from "lodash.merge";
import type { z } from "zod";
import { getLogger, type ILogger } from "./logger";
import { buildOpenAPIPathsObject } from "./openapi";
import { commonReponses } from "./responses";
import {
  type ErrorResponse,
  errorResponseSchema,
  type IMakeRequestHandlerProps,
  type IMakeRequestHandlerReturn,
} from "./types";
import {
  getKeysFromPathPattern,
  getParamsFromPath,
  type HTTPMethod,
  httpMethodSupportsRequestBody,
} from "./utils";

/**
 * Result of extracting raw input from request
 */
type ExtractRawInputResult =
  | { success: true; data: Record<string, unknown> }
  | { success: false; error: "invalid_json" };

/**
 * Authentication result type from user-provided authenticate function
 */
type AuthenticateResult<TAuthContext> =
  | { authenticated: true; context: TAuthContext }
  | { authenticated: false; reason: string };

function getLoggingPrefix(request: Request): string {
  const url = new URL(request.url);
  return `Handler ${request.method} ${url.pathname}`;
}

/**
 * Extract raw input data from request (path params, query params, or body)
 * before Zod validation
 */
async function extractRawInput(
  request: Request,
  path: string,
  logger: ILogger
): Promise<ExtractRawInputResult> {
  const url = new URL(request.url);
  const logPrefix = getLoggingPrefix(request);

  // Extract path parameters
  const pathParams = getParamsFromPath(path, url.pathname);

  // Extract body or query parameters based on HTTP method
  let bodyOrQueryParams: Record<string, unknown> = {};

  if (httpMethodSupportsRequestBody[request.method as HTTPMethod]) {
    // Read body as text first to check if it's empty
    const bodyText = await request.text();

    if (bodyText.trim() === "") {
      // Empty body is allowed - treat as empty object
      bodyOrQueryParams = {};
    } else {
      // Try to parse as JSON
      try {
        bodyOrQueryParams = JSON.parse(bodyText);
      } catch (error) {
        logger.log("warn", `${logPrefix} error parsing request body`, {
          error: error instanceof Error ? error : new Error(String(error)),
          url: request.url,
        });
        return { success: false, error: "invalid_json" };
      }
    }
  } else {
    bodyOrQueryParams = Object.fromEntries(url.searchParams.entries());
  }

  return {
    success: true,
    data: {
      ...pathParams,
      ...bodyOrQueryParams,
    },
  };
}

/**
 * Handle authentication if required
 * @returns The auth result (authenticated: true with context undefined if no auth function)
 */
async function handleAuthentication<TAuthContext>(
  authenticate:
    | ((request: Request) => Promise<AuthenticateResult<TAuthContext>>)
    | undefined,
  request: Request,
  logger: ILogger,
  loggingPrefix: string
): Promise<AuthenticateResult<TAuthContext>> {
  if (!authenticate) {
    // as cast since we know that if the authenticat is not provided, the context will be undefined
    return { authenticated: true, context: undefined as TAuthContext };
  }

  const requestForAuth = request.clone();

  try {
    const result = await authenticate(requestForAuth);

    if (!result.authenticated) {
      logger.log(
        "debug",
        `${loggingPrefix} authentication failed: ${result.reason}`,
        {
          url: request.url,
          reason: result.reason,
        }
      );
    }

    return result;
  } catch (error) {
    logger.log("error", `${loggingPrefix} error during authentication check`, {
      error: error instanceof Error ? error : new Error(String(error)),
      url: request.url,
    });
    // Fail closed: auth errors should reject the request
    return { authenticated: false, reason: "Authentication error" };
  }
}

/**
 * Validate input data against a Zod schema
 * @returns Object with validated data on success, or Response on failure
 */
async function validateInput<TInput extends z.ZodObject<any, any>>(
  schema: TInput,
  unsafeData: Record<string, unknown>,
  logger: ILogger,
  loggingPrefix: string,
  url: string
): Promise<
  | { success: true; data: z.infer<TInput> }
  | { success: false; response: Response }
> {
  const parsedData = await schema.safeParseAsync(unsafeData);

  if (!parsedData.success) {
    logger.log("warn", `${loggingPrefix} request validation failed`, {
      validationError: parsedData.error,
      receivedInput: unsafeData,
      url,
    });
    return {
      success: false,
      response: commonReponses[400].response(parsedData.error),
    };
  }

  return { success: true, data: parsedData.data };
}

export const makeRequestHandler = <
  TInput extends z.ZodObject<any, any>,
  TOutput extends z.ZodObject<any, any>,
  TMethod extends HTTPMethod,
  TPath extends string,
  TAuthContext = void,
>(
  props: IMakeRequestHandlerProps<TInput, TOutput, TMethod, TPath, TAuthContext>
): IMakeRequestHandlerReturn<TInput, TOutput, TMethod, TPath> => {
  // Validate that all path parameters are defined in the input schema
  const pathKeys = getKeysFromPathPattern(props.path);
  const missingParams = pathKeys.filter(
    (key) => !(key.name in props.input.shape)
  );
  if (missingParams.length > 0) {
    const missingNames = missingParams.map((p) => `"${p.name}"`).join(", ");
    throw new Error(
      `Path parameter${
        missingParams.length > 1 ? "s" : ""
      } ${missingNames} in "${props.path}" ${
        missingParams.length > 1 ? "are" : "is"
      } not defined in the input schema`
    );
  }

  const openAPIPathsObject = buildOpenAPIPathsObject({
    input: props.input,
    output: props.output,
    method: props.method,
    path: props.path,
    description: props.description,
    tags: props.tags,
    requiresAuth: !!props.authenticate,
  });

  const handler = async (request: Request) => {
    const logger = getLogger();
    const requestForRun = request.clone();
    const loggingPrefix = getLoggingPrefix(request);

    logger.log("debug", `${loggingPrefix} begin`);

    // ensure the method is correct
    if (request.method !== props.method) {
      logger.log(
        "warn",
        `${loggingPrefix} invalid HTTP method: received ${request.method}, expected ${props.method}`,
        {
          expectedMethod: props.method,
          actualMethod: request.method,
          url: request.url,
        }
      );
      return commonReponses[405].response();
    }

    // Handle authentication if required
    const authResult = await handleAuthentication(
      props.authenticate,
      request,
      logger,
      loggingPrefix
    );
    if (!authResult.authenticated) {
      return commonReponses[401].response();
    }

    // Extract and validate input
    const extractResult = await extractRawInput(request, props.path, logger);
    if (!extractResult.success) {
      return commonReponses[400].response({ message: "Invalid JSON body" });
    }

    const validationResult = await validateInput(
      props.input,
      extractResult.data,
      logger,
      loggingPrefix,
      request.url
    );
    if (!validationResult.success) return validationResult.response;

    const input = validationResult.data;

    // utility function to send output response
    const sendOutput = async (
      output: z.infer<TOutput>,
      options?: Partial<ResponseInit>
    ) => {
      const parsedOutput = await props.output.safeParseAsync(output);

      if (!parsedOutput.success) {
        logger.log("error", `${loggingPrefix} output validation failed`, {
          validationError: parsedOutput.error,
          url: request.url,
        });
        return commonReponses[500].response(
          new Error("Response validation failed")
        );
      }

      logger.log("debug", `${loggingPrefix} success ${options?.status ?? 200}`);
      return new Response(
        JSON.stringify(parsedOutput.data),
        merge(
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
          options
        )
      );
    };

    const sendError = async (
      { status, message, data }: { status: number } & ErrorResponse,
      options?: Partial<Omit<ResponseInit, "status">>
    ) => {
      const parsedError = errorResponseSchema.safeParse({ message, data });

      if (!parsedError.success) {
        logger.log(
          "error",
          `${loggingPrefix} error response validation failed`,
          {
            validationError: parsedError.error,
            url: request.url,
          }
        );
        return commonReponses[500].response(
          new Error("Error response validation failed")
        );
      }

      logger.log("debug", `${loggingPrefix} error ${status}`);
      return new Response(
        JSON.stringify(parsedError.data),
        merge(
          {
            status,
            headers: {
              "Content-Type": "application/json",
            },
          },
          options
        )
      );
    };

    // run the user's code
    try {
      return await props.run({
        request: requestForRun,
        input,
        authContext: authResult.context,
        sendOutput,
        sendError,
      });
    } catch (error) {
      logger.log(
        "error",
        `${loggingPrefix} unhandled error when handling request`,
        {
          error: error instanceof Error ? error : new Error(String(error)),
          input,
          url: request.url,
        }
      );
      return commonReponses[500].response(error);
    }
  };

  return {
    clientConfig: {
      input: {} as any, // implementation does not matter, we just need the types
      output: props.output, // echo the zod schema
      method: props.method,
      path: props.path,
    },
    openAPIPathsObject,
    handler,
  };
};
