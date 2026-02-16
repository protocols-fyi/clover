import type { oas31 } from "openapi3-ts";
import { z } from "zod";
import type { HTTPMethod } from "./utils";

export const errorResponseSchema = z.object({
  message: z.string(),
  data: z.record(z.string(), z.any()).optional(),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/**
 * Function type for sending successful responses.
 * Useful when building custom response wrappers.
 *
 * @example
 * ```typescript
 * import type { SendOutputFn } from '@protocols-fyi/clover';
 *
 * // Wrap sendOutput to add custom headers
 * const wrappedSendOutput: SendOutputFn<MyOutputSchema> = async (output, options) => {
 *   const headers = new Headers(options?.headers ?? {});
 *   headers.set('X-Custom-Header', 'value');
 *   return sendOutput(output, { ...options, headers });
 * };
 * ```
 */
export type SendOutputFn<TOutput extends z.ZodObject<any, any>> = (
  output: z.infer<TOutput>,
  options?: Partial<ResponseInit>
) => Promise<Response>;

/**
 * Function type for sending error responses.
 * Useful when building custom error handlers.
 *
 * @example
 * ```typescript
 * import type { SendErrorFn } from '@protocols-fyi/clover';
 *
 * // Wrap sendError to add tracking headers
 * const wrappedSendError: SendErrorFn = async (error, options) => {
 *   const headers = new Headers(options?.headers ?? {});
 *   headers.set('X-Request-ID', requestId);
 *   return sendError(error, { ...options, headers });
 * };
 * ```
 */
export type SendErrorFn = (
  error: { status: number; message: string; data?: Record<string, unknown> },
  options?: Partial<Omit<ResponseInit, "status">>
) => Promise<Response>;

/**
 * The props passed to the run callback in makeRequestHandler.
 * Use this type when building wrappers or extending handler functionality.
 *
 * @example
 * ```typescript
 * import type { RunCallbackProps } from '@protocols-fyi/clover';
 *
 * // Extend with custom properties
 * type MyRunProps<TInput, TOutput> = RunCallbackProps<TInput, TOutput, void> & {
 *   requestId: string;
 *   db: DatabaseClient;
 *   logger: CustomLogger;
 * };
 * ```
 */
export type RunCallbackProps<
  TInput extends z.ZodObject<any, any>,
  TOutput extends z.ZodObject<any, any>,
  TAuthContext = void,
> = {
  /**
   * The raw request object
   */
  request: Request;

  /**
   * The parsed and validated input data
   */
  input: z.infer<TInput>;

  /**
   * The context returned from the authenticate function (void if no auth configured)
   */
  authContext: TAuthContext;

  /**
   * Helper to send a successful response
   */
  sendOutput: SendOutputFn<TOutput>;

  /**
   * Helper to send an error response
   */
  sendError: SendErrorFn;
};

export interface IMakeRequestHandlerProps<
  TInput extends z.ZodObject<any, any>,
  TOutput extends z.ZodObject<any, any>,
  TMethod extends HTTPMethod,
  TPath extends string,
  TAuthContext = void,
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
  authenticate?: (request: Request) => Promise<
    | {
        authenticated: true;
        context: TAuthContext;
      }
    | {
        authenticated: false;
        reason: string;
      }
  >;
  /**
   * a callback inside which you can run your logic
   * @returns a response to send back to the client
   */
  run: (
    props: RunCallbackProps<TInput, TOutput, TAuthContext>
  ) => Promise<Response>;
}

export interface IClientConfig<
  TInput extends z.ZodObject<any, any>,
  TOutput extends z.ZodObject<any, any>,
  TMethod extends HTTPMethod,
  TPath extends string,
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
  TPath extends string,
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
