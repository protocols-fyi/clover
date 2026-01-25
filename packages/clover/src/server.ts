import merge from "lodash.merge";
import { oas31 } from "openapi3-ts";
import { z } from "zod";
import { commonReponses } from "./responses";
import {
  HTTPMethod,
  getKeysFromPathPattern,
  getParamsFromPath,
  httpMethodSupportsRequestBody,
} from "./utils";
import { getLogger, ILogger } from "./logger";
import { buildOpenAPIPathsObject } from "./openapi";

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
): Promise<Record<string, unknown>> {
  const url = new URL(request.url);
  const logPrefix = getLoggingPrefix(request);

  // Extract path parameters
  const pathParams = getParamsFromPath(path, url.pathname);

  // Extract body or query parameters based on HTTP method
  let bodyOrQueryParams: Record<string, unknown> = {};

  if (httpMethodSupportsRequestBody[request.method as HTTPMethod]) {
    try {
      bodyOrQueryParams = await request.json();
    } catch (error) {
      logger.log("warn", `${logPrefix} error parsing request body`, {
        error: error instanceof Error ? error : new Error(String(error)),
        url: request.url,
      });
      // Return empty object if body is not valid JSON
      bodyOrQueryParams = {};
    }
  } else {
    bodyOrQueryParams = Object.fromEntries(url.searchParams.entries());
  }

  return {
    ...pathParams,
    ...bodyOrQueryParams,
  };
}

/**
 * Authentication result type from user-provided authenticate function
 */
type AuthenticateResult<TAuthContext> =
  | { authenticated: true; context: TAuthContext }
  | { authenticated: false; reason: string };

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
      logger.log("debug", `${loggingPrefix} authentication failed: ${result.reason}`, {
        url: request.url,
        reason: result.reason,
      });
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
  { success: true; data: z.infer<TInput> } | { success: false; response: Response }
> {
  const parsedData = await schema.safeParseAsync(unsafeData);

  if (!parsedData.success) {
    logger.log("warn", `${loggingPrefix} request validation failed`, {
      validationError: parsedData.error,
      receivedInput: unsafeData,
      url,
    });
    return { success: false, response: commonReponses[400].response(parsedData.error) };
  }

  return { success: true, data: parsedData.data };
}

export interface IMakeRequestHandlerProps<
  TInput extends z.ZodObject<any, any>,
  TOutput extends z.ZodObject<any, any>,
  TMethod extends HTTPMethod,
  TPath extends string,
  TAuthContext = void
> {
  /**
   * describe the shape of the input
   */
  input: TInput;
  /**
   * describe the shape of the output
   */
  output: TOutput;
  /**
   * specify the HTTP method
   */
  method: TMethod;
  /**
   * specify the path
   */
  path: TPath;
  /**
   * optional description
   */
  description?: string;
  /**
   * optional tags
   */
  tags?: string[];
  /**
   * the presence of this property will make the route require bearer authentication
   * @param request - the request, do whatever you want with it
   * @returns - if false, the request will be rejected
   */
  authenticate?: (request: Request) => Promise<{
    authenticated: true;
    context: TAuthContext;
  } | {
    authenticated: false;
    reason: string;
  }>;
  /**
   * a callback inside which you can run your logic
   * @returns a response to send back to the client
   */
  run: ({
    request,
    input,
    authContext,
    sendOutput,
    sendError,
  }: {
    /**
     * the raw request, do whatever you want with it
     */
    request: Request;
    /**
     * a helper with the input data
     */
    input: z.infer<TInput>;
    /**
     * the context returned from the authenticate function (void if no auth configured)
     */
    authContext: TAuthContext;
    /**
     * @param output - the output data
     * @param options Request options
     * @returns a helper to send the output
     */
    sendOutput: (
      output: z.infer<TOutput>,
      options?: Partial<ResponseInit>
    ) => Promise<Response>;
    /**
     * @param status - the status code
     * @param message - the error message
     * @param data - any additional data
     * @returns a helper to send the output
     */
    sendError: ({
      status,
      message,
      data,
    }: { status: number } & ErrorResponse) => Promise<Response>;
  }) => Promise<Response>;
}

export interface IClientConfig<
  TInput extends z.ZodObject<any, any>,
  TOutput extends z.ZodObject<any, any>,
  TMethod extends HTTPMethod,
  TPath extends string
> {
  /**
   * the typescript types for the input
   * exclude the path parameters that are automatically added
   */
  // input: HumanReadable<Omit<z.infer<TInput>, PathParamNames<TPath>>>;
  input: z.infer<TInput>;
  /**
   * the zod schema for the output
   */
  output: TOutput;
  /**
   * the HTTP method
   */
  method: TMethod;
  /**
   * the path the route is available on
   */
  path: TPath;
}

export interface IMakeRequestHandlerReturn<
  TInput extends z.ZodObject<any, any>,
  TOutput extends z.ZodObject<any, any>,
  TMethod extends HTTPMethod,
  TPath extends string
> {
  /**
   * config object used to generate typescript types
   */
  clientConfig: IClientConfig<TInput, TOutput, TMethod, TPath>;
  /**
   * OpenAPI schema for this route
   */
  openAPIPathsObject: oas31.PathsObject;
  /**
   * @returns WinterCG compatible handler that you can use in your routes
   */
  handler: (request: Request) => Promise<Response>;
}

export const errorResponseSchema = z.object({
  message: z.string(),
  data: z.record(z.string(), z.any()).optional(),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const makeRequestHandler = <
  TInput extends z.ZodObject<any, any>,
  TOutput extends z.ZodObject<any, any>,
  TMethod extends HTTPMethod,
  TPath extends string,
  TAuthContext = void
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
      `Path parameter${missingParams.length > 1 ? "s" : ""} ${missingNames} in "${props.path}" ${missingParams.length > 1 ? "are" : "is"} not defined in the input schema`
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
        `${loggingPrefix} invalid HTTP method: received ${
          request.method
        }, expected ${props.method}`,
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
    const unsafeData = await extractRawInput(request, props.path, logger);
    const validationResult = await validateInput(
      props.input,
      unsafeData,
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
      logger.log(
        "debug",
        `${loggingPrefix} success ${options?.status ?? 200}`
      );
      return new Response(
        JSON.stringify(output),
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

    const sendError = async ({
      status,
      message,
      data,
    }: { status: number } & ErrorResponse) => {
      logger.log("debug", `${loggingPrefix} error ${status}`);
      return new Response(JSON.stringify({ message, data }), {
        status,
        headers: {
          "Content-Type": "application/json",
        },
      });
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
