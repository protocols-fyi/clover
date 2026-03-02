import { compile } from "path-to-regexp";
import type { z } from "zod";
import type { IClientConfig } from "./types";
import { type HTTPMethod, httpMethodSupportsRequestBody } from "./utils";

export interface IMakeFetcherProps {
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
export const makeFetcher = (outerProps: IMakeFetcherProps) => {
  /**
   *
   * @param props - the props to make the request
   * @returns the response from the server
   */
  const fetcher = async <
    TConfig extends IClientConfig<
      z.ZodObject<any, any>,
      z.ZodObject<any, any>,
      HTTPMethod,
      string
    >,
  >(
    props: Pick<TConfig, "input" | "method" | "path"> & {
      validator?: TConfig["output"];
    }
  ): Promise<z.infer<TConfig["output"]>> => {
    // Extract only string values for path param substitution.
    // Path params are always strings since they come from URL segments,
    // but the input object may also contain non-string body/query fields.
    const pathParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(props.input)) {
      if (typeof value === "string") {
        pathParams[key] = value;
      }
    }
    const pathSubstitutor = compile<Record<string, string>>(props.path);
    const substitutedPath = pathSubstitutor(pathParams);

    // create a ful url to the endpoint
    const url = new URL(substitutedPath, outerProps.baseUrl);

    const resp = await fetch(
      // if the method supports a request body, send as JSON
      // otherwise, send as query params
      httpMethodSupportsRequestBody[props.method]
        ? url
        : new URL(
            `${url.toString()}?${new URLSearchParams(props.input as any)}`
          ),
      {
        method: props.method,
        headers: {
          ...(httpMethodSupportsRequestBody[props.method]
            ? { "Content-Type": "application/json" }
            : {}),
          ...(outerProps.headers
            ? Object.fromEntries(outerProps.headers.entries())
            : {}),
        },
        body: httpMethodSupportsRequestBody[props.method]
          ? JSON.stringify(props.input)
          : undefined,
      }
    );

    const output = await resp.json();

    if (props.validator) {
      props.validator.parse(output);
    }

    return output;
  };

  return fetcher;
};
