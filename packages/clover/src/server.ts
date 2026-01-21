import merge from "lodash.merge";
import { oas31 } from "openapi3-ts";
import { z } from "zod";
import { createSchema } from "zod-openapi";
import { commonReponses } from "./responses";
import {
  HTTPMethod,
  getKeysFromPathPattern,
  getParamsFromPath,
  httpMethodSupportsRequestBody,
  toOpenAPIPath,
} from "./utils";
import { getLogger, formatLogPayload } from "./logger";

export interface IMakeRequestHandlerProps<
  TInput extends z.ZodObject<any, any>,
  TOutput extends z.ZodObject<any, any>,
  TMethod extends HTTPMethod,
  TPath extends string
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
  authenticate?: (request: Request) => Promise<boolean>;
  /**
   * a callback inside which you can run your logic
   * @returns a response to send back to the client
   */
  run: ({
    request,
    input,
    sendOutput,
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
  TPath extends string
>(
  props: IMakeRequestHandlerProps<TInput, TOutput, TMethod, TPath>
): IMakeRequestHandlerReturn<TInput, TOutput, TMethod, TPath> => {
  const getLoggingPrefix = (request: Request) => {
    const url = new URL(request.url);
    return `Handler ${request.method} ${url.pathname}`;
  };

  const openAPIParameters: (oas31.ParameterObject | oas31.ReferenceObject)[] = [
    // query parameters
    ...(!httpMethodSupportsRequestBody[props.method]
      ? Object.keys(props.input.shape)
          // exclude query parameters that are already path parameters
          .filter((key) => {
            return !getKeysFromPathPattern(props.path).some(
              (k) => String(k.name) === key
            );
          })
          .map((key) => {
            const fieldSchema = props.input.shape[key];
            const { schema } = createSchema(fieldSchema);

            // Determine if parameter is required by checking if it's optional
            const isOptional = fieldSchema.isOptional?.() ?? false;

            return {
              name: key,
              in: "query" as oas31.ParameterLocation,
              required: !isOptional,
              schema: schema,
            };
          })
      : []),
    // add path parameters
    ...getKeysFromPathPattern(props.path).map((key) => {
      const fieldSchema = props.input.shape[key.name];
      const { schema } = createSchema(fieldSchema);

      return {
        name: String(key.name),
        in: "path" as oas31.ParameterLocation,
        required: true, // Path params are always required
        schema: schema,
      };
    }),
  ];

  const openAPIRequestBody:
    | oas31.ReferenceObject
    | oas31.RequestBodyObject
    | undefined = httpMethodSupportsRequestBody[props.method]
    ? {
        content: {
          "application/json": {
            schema: createSchema(props.input).schema,
          },
        },
      }
    : undefined;

  const openAPIOperation: oas31.OperationObject = {
    description: props.description,
    parameters: openAPIParameters,
    requestBody: openAPIRequestBody,
    responses: {
      // success
      200: {
        description: "Success",
        content: {
          "application/json": {
            schema: createSchema(props.output).schema,
          },
        },
      },
      // bad request
      400: commonReponses[400].openAPISchema,
      // unauthorized
      401: props.authenticate ? commonReponses[401].openAPISchema : undefined,
      // sarim: i don't think we need this
      // 405: commonReponses[405].openAPISchema,
    },
    tags: props.tags,
  };

  const openAPIPathItem: oas31.PathItemObject = {
    [props.method.toLowerCase()]: openAPIOperation,
  };

  const openAPIPath: oas31.PathsObject = {
    [toOpenAPIPath(props.path)]: openAPIPathItem,
  };

  const handler = async (request: Request) => {
    const logger = getLogger();
    const requestForRun = request.clone();
    const requestForAuth = request.clone();

    logger.log("debug", `${getLoggingPrefix(request)} begin`);

    // ensure the method is correct
    if (request.method !== props.method) {
      logger.log(
        "warn",
        `${getLoggingPrefix(request)} invalid HTTP method: received ${
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

    let authenticationResult = false;

    try {
      authenticationResult =
        props.authenticate !== undefined &&
        !(await props.authenticate(requestForAuth));
    } catch (error) {
      logger.log(
        "error",
        `${getLoggingPrefix(request)} error during authentication check`,
        {
          error: error instanceof Error ? error : new Error(String(error)),
          url: request.url,
        }
      );
    }

    // ensure authentication is correct
    if (authenticationResult) {
      logger.log(
        "debug",
        `${getLoggingPrefix(request)} authentication check returned false`,
        {
          url: request.url,
        }
      );
      return commonReponses[401].response();
    }

    // parse the input
    const unsafeData = {
      // parse input from path parameters
      ...getParamsFromPath(props.path, new URL(request.url).pathname),
      // parse input from query parameters or body
      ...(httpMethodSupportsRequestBody[request.method as HTTPMethod]
        ? // if the method supports a body, parse it
          await request.json().catch((error) => {
            logger.log(
              "warn",
              `${getLoggingPrefix(request)} error parsing request body`,
              {
                error:
                  error instanceof Error ? error : new Error(String(error)),
                url: request.url,
              }
            );
            // Just return an empty object if the body is not valid JSON
            return {};
          })
        : // otherwise, parse the query parameters
          Object.fromEntries(new URL(request.url).searchParams.entries())),
    };

    // parse the input with zod schema
    const parsedData = await props.input.safeParseAsync(unsafeData);

    // if the input is invalid, return a 400
    if (!parsedData.success) {
      logger.log(
        "warn",
        `${getLoggingPrefix(request)} request validation failed`,
        {
          validationError: parsedData.error,
          receivedInput: unsafeData,
          url: request.url,
        }
      );
      return commonReponses[400].response(parsedData.error);
    }

    const input = parsedData.data;

    // utility function to send output response
    const sendOutput = async (
      output: z.infer<TOutput>,
      options?: Partial<ResponseInit>
    ) => {
      logger.log(
        "debug",
        `${getLoggingPrefix(request)} success ${options?.status ?? 200}`
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
      logger.log("debug", `${getLoggingPrefix(request)} error ${status}`);
      return new Response(JSON.stringify({ message, data }), {
        status,
        headers: {
          "Content-Type": "application/json",
        },
      });
    };

    // run the user's code
    try {
      const response = await props.run({
        request: requestForRun,
        input,
        sendOutput,
        sendError,
      });

      logger.log(
        "debug",
        `${getLoggingPrefix(request)} success ${response.status}`
      );

      return response;
    } catch (error) {
      logger.log(
        "error",
        `${getLoggingPrefix(request)} unhandled error when handling request`,
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
    openAPIPathsObject: openAPIPath,
    handler,
  };
};
