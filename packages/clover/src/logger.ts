export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogMethod = (
  level: LogLevel,
  message: string,
  meta?: Record<string, any>
) => void;

export interface ILogger {
  log: LogMethod;
}

// Default no-op logger
export const defaultLogger: ILogger = {
  log: () => {},
};

let globalLogger: ILogger = defaultLogger;

export const setLogger = (logger: ILogger) => {
  globalLogger = logger;
};

export const getLogger = () => globalLogger;

// Helper to normalize logging calls
export const formatLogPayload = (
  level: LogLevel,
  message: string,
  meta?: Record<string, any>
) => ({
  level,
  message,
  ...(meta || {}),
});
