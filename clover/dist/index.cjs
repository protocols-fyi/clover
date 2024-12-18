"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/index.ts
var src_exports = {};
__export(src_exports, {
  makeFetcher: () => makeFetcher,
  makeRequestHandler: () => makeRequestHandler
});
module.exports = __toCommonJS(src_exports);

// src/client.ts
var import_path_to_regexp2 = require("path-to-regexp");

// src/utils.ts
var import_path_to_regexp = require("path-to-regexp");
var httpMethodSupportsRequestBody = {
  GET: false,
  POST: true,
  PUT: true,
  PATCH: true,
  DELETE: false
};
var getKeysFromPathPattern = (pattern) => {
  const keys = [];
  (0, import_path_to_regexp.pathToRegexp)(pattern, keys);
  return keys;
};
var getParamsFromPath = (pattern, input) => {
  const matcher = (0, import_path_to_regexp.match)(pattern, { decode: decodeURIComponent });
  const result = matcher(input);
  if (!result) {
    return {};
  }
  return result.params;
};

// src/client.ts
var makeFetcher = (outerProps) => {
  const fetcher = (props) => __async(void 0, null, function* () {
    const pathSubstitutor = (0, import_path_to_regexp2.compile)(props.path);
    const substitutedPath = pathSubstitutor(props.input);
    const url = new URL(substitutedPath, outerProps.baseUrl);
    const resp = yield fetch(
      // if the method supports a request body, send as JSON
      // otherwise, send as query params
      httpMethodSupportsRequestBody[props.method] ? url : new URL(url.toString() + "?" + new URLSearchParams(props.input)),
      {
        method: props.method,
        headers: __spreadValues(__spreadValues({}, httpMethodSupportsRequestBody[props.method] ? { "Content-Type": "application/json" } : {}), outerProps.headers ? Object.fromEntries(outerProps.headers.entries()) : {}),
        body: httpMethodSupportsRequestBody[props.method] ? JSON.stringify(props.input) : void 0
      }
    );
    const output = yield resp.json();
    if (props.validator) {
      props.validator.parse(output);
    }
    return output;
  });
  return fetcher;
};

// src/server.ts
var import_zod_openapi = require("@anatine/zod-openapi");
var import_lodash = __toESM(require("lodash.merge"), 1);
var import_zod = require("zod");

// src/responses.ts
var commonReponses = {
  405: {
    openAPISchema: {
      description: "Method not allowed",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              error: {
                type: "string"
              }
            }
          }
        }
      }
    },
    response: () => new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405
    })
  },
  400: {
    openAPISchema: {
      description: "Bad request",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              error: {
                type: "string"
              },
              details: {
                type: "object"
              }
            }
          }
        }
      }
    },
    response: (details) => new Response(JSON.stringify({ error: "Bad request", details }), {
      status: 400
    })
  },
  401: {
    openAPISchema: {
      description: "Unauthorized"
    },
    response: () => new Response(null, { status: 401 })
  },
  500: {
    openAPISchema: {
      description: "Internal server error"
    },
    response: (error) => new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
};

// src/server.ts
var errorResponseSchema = import_zod.z.object({
  message: import_zod.z.string(),
  data: import_zod.z.record(import_zod.z.any()).optional()
});
var makeRequestHandler = (props) => {
  const openAPIParameters = [
    // query parameters
    ...!httpMethodSupportsRequestBody[props.method] ? Object.keys(props.input.shape).filter((key) => {
      return !getKeysFromPathPattern(props.path).some(
        (k) => String(k.name) === key
      );
    }).map((key) => {
      return {
        name: key,
        in: "query",
        schema: {
          type: "string"
        }
      };
    }) : [],
    // add path parameters
    ...getKeysFromPathPattern(props.path).map((key) => ({
      name: String(key.name),
      in: "path",
      required: true,
      schema: {
        type: "string"
      }
    }))
  ];
  const openAPIRequestBody = httpMethodSupportsRequestBody[props.method] ? {
    content: {
      "application/json": {
        schema: (0, import_zod_openapi.generateSchema)(props.input)
      }
    }
  } : void 0;
  const openAPIOperation = {
    description: props.description,
    security: props.authenticate ? [{ bearerAuth: [] }] : void 0,
    parameters: openAPIParameters,
    requestBody: openAPIRequestBody,
    responses: {
      // success
      200: {
        description: "Success",
        content: {
          "application/json": {
            schema: (0, import_zod_openapi.generateSchema)(props.output)
          }
        }
      },
      // bad request
      400: commonReponses[400].openAPISchema,
      // unauthorized
      401: props.authenticate ? commonReponses[401].openAPISchema : void 0
      // sarim: i don't think we need this
      // 405: commonReponses[405].openAPISchema,
    },
    tags: props.tags
  };
  const openAPIPathItem = {
    [props.method.toLowerCase()]: openAPIOperation
  };
  const openAPIPath = {
    [props.path]: openAPIPathItem
  };
  const handler = (request) => __async(void 0, null, function* () {
    const requestForRun = request.clone();
    const requestForAuth = request.clone();
    if (request.method !== props.method) {
      return commonReponses[405].response();
    }
    if (props.authenticate && !(yield props.authenticate(requestForAuth))) {
      return commonReponses[401].response();
    }
    const unsafeData = __spreadValues(__spreadValues({}, getParamsFromPath(props.path, new URL(request.url).pathname)), httpMethodSupportsRequestBody[request.method] ? (
      // if the method supports a body, parse it
      yield request.json()
    ) : (
      // otherwise, parse the query parameters
      Object.fromEntries(new URL(request.url).searchParams.entries())
    ));
    const parsedData = yield props.input.safeParseAsync(unsafeData);
    if (!parsedData.success) {
      return commonReponses[400].response(parsedData.error);
    }
    const input = parsedData.data;
    const sendOutput = (output, options) => __async(void 0, null, function* () {
      return new Response(
        JSON.stringify(output),
        (0, import_lodash.default)(
          {
            status: 200,
            headers: {
              "Content-Type": "application/json"
            }
          },
          options
        )
      );
    });
    const sendError = (_0) => __async(void 0, [_0], function* ({ status, message, data }) {
      return new Response(
        JSON.stringify({ message, data }),
        {
          status,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    });
    try {
      return yield props.run({ request: requestForRun, input, sendOutput, sendError });
    } catch (error) {
      return commonReponses[500].response(error);
    }
  });
  return {
    clientConfig: {
      input: {},
      // implementation does not matter, we just need the types
      output: props.output,
      // echo the zod schema
      method: props.method,
      path: props.path
    },
    openAPIPathsObject: openAPIPath,
    handler
  };
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  makeFetcher,
  makeRequestHandler
});
