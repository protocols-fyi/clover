import { z } from 'zod';
import { oas31 } from 'openapi3-ts';

type OpenAPIObject = oas31.OpenAPIObject;
type OpenAPIPathsObject = oas31.PathsObject;
type OpenAPIPathItemObject = oas31.PathItemObject;
type HTTPMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface IMakeRequestHandlerProps<TInput extends z.AnyZodObject, TOutput extends z.AnyZodObject, TMethod extends HTTPMethod, TPath extends string> {
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
    run: ({ request, input, sendOutput, }: {
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
        sendOutput: (output: z.infer<TOutput>, options?: Partial<ResponseInit>) => Promise<Response>;
        /**
         * @param status - the status code
         * @param message - the error message
         * @param data - any additional data
         * @returns a helper to send the output
         */
        sendError: ({ status, message, data }: {
            status: number;
        } & ErrorResponse) => Promise<Response>;
    }) => Promise<Response>;
}
interface IClientConfig<TInput extends z.AnyZodObject, TOutput extends z.AnyZodObject, TMethod extends HTTPMethod, TPath extends string> {
    /**
     * the typescript types for the input
     * exclude the path parameters that are automatically added
     */
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
interface IMakeRequestHandlerReturn<TInput extends z.AnyZodObject, TOutput extends z.AnyZodObject, TMethod extends HTTPMethod, TPath extends string> {
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
declare const errorResponseSchema: z.ZodObject<{
    message: z.ZodString;
    data: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    message: string;
    data?: Record<string, any> | undefined;
}, {
    message: string;
    data?: Record<string, any> | undefined;
}>;
type ErrorResponse = z.infer<typeof errorResponseSchema>;
declare const makeRequestHandler: <TInput extends z.AnyZodObject, TOutput extends z.AnyZodObject, TMethod extends HTTPMethod, TPath extends string>(props: IMakeRequestHandlerProps<TInput, TOutput, TMethod, TPath>) => IMakeRequestHandlerReturn<TInput, TOutput, TMethod, TPath>;

interface IMakeFetcherProps {
    /**
     * the base URL of the server
     */
    baseUrl: string;
    /**
     * headers to send with every request
     */
    headers?: Headers;
}
/**
 *
 * @param outerProps - the props to configure the fetcher
 * @returns a function that can be used to make requests to the server
 */
declare const makeFetcher: (outerProps: IMakeFetcherProps) => <TConfig extends IClientConfig<z.AnyZodObject, z.AnyZodObject, HTTPMethod, string>>(props: Pick<TConfig, "input" | "method" | "path"> & {
    validator?: TConfig["output"];
}) => Promise<z.infer<TConfig["output"]>>;

export { IMakeFetcherProps, IMakeRequestHandlerProps, IMakeRequestHandlerReturn, OpenAPIObject, OpenAPIPathItemObject, OpenAPIPathsObject, makeFetcher, makeRequestHandler };
