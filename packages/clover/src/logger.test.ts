import { describe, expect, it, vi } from "vitest";
import type { ILogger } from "./logger";
import { formatLogPayload, getLogger, setLogger } from "./logger";

describe("Logger", () => {
  it("should allow setting and getting a custom logger", () => {
    const mockLogger: ILogger = {
      log: vi.fn(),
    };

    setLogger(mockLogger);
    expect(getLogger()).toBe(mockLogger);
  });

  it("should support different logging patterns", () => {
    const logs: any[] = [];

    const testLogger: ILogger = {
      log: (...args: any[]) => logs.push(args),
    };

    setLogger(testLogger);
    const logger = getLogger();

    // Test different logging patterns
    logger.log("info", "message only");
    logger.log("error", "message with meta", { context: "test" });

    expect(logs).toHaveLength(2);
    expect(logs[0]).toEqual(["info", "message only"]);
    expect(logs[1]).toEqual([
      "error",
      "message with meta",
      { context: "test" },
    ]);
  });

  it("should format log payloads correctly", () => {
    expect(formatLogPayload("info", "test message")).toEqual({
      level: "info",
      message: "test message",
    });

    expect(
      formatLogPayload("error", "test message", { context: "test" })
    ).toEqual({
      level: "error",
      message: "test message",
      context: "test",
    });
  });
});
