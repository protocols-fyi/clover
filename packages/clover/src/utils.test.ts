import { describe, it, expect } from "vitest";
import {
  getKeysFromPathPattern,
  getParamsFromPath,
  toOpenAPIPath,
} from "./utils";

describe("utils", () => {
  describe("getKeysFromPathPattern", () => {
    it("should extract path parameters", () => {
      const pattern = "/api/users/:id";
      const keys = getKeysFromPathPattern(pattern);
      expect(keys).toHaveLength(1);
      expect(keys[0].name).toBe("id");
    });

    it("should handle multiple parameters", () => {
      const pattern = "/api/users/:userId/posts/:postId";
      const keys = getKeysFromPathPattern(pattern);
      expect(keys).toHaveLength(2);
      expect(keys[0].name).toBe("userId");
      expect(keys[1].name).toBe("postId");
    });
  });

  describe("getParamsFromPath", () => {
    it("should extract parameters from actual path", () => {
      const pattern = "/api/users/:id";
      const path = "/api/users/123";
      const params = getParamsFromPath(pattern, path);
      expect(params).toEqual({ id: "123" });
    });
  });

  describe("toOpenAPIPath", () => {
    it("should convert single parameter", () => {
      expect(toOpenAPIPath("/api/users/:id")).toBe("/api/users/{id}");
    });

    it("should convert multiple parameters", () => {
      expect(toOpenAPIPath("/api/users/:userId/posts/:postId")).toBe(
        "/api/users/{userId}/posts/{postId}"
      );
    });

    it("should handle paths without parameters", () => {
      expect(toOpenAPIPath("/api/users")).toBe("/api/users");
    });

    it("should handle parameter at end of path", () => {
      expect(toOpenAPIPath("/api/v1/catalog/:collection/:scenario")).toBe(
        "/api/v1/catalog/{collection}/{scenario}"
      );
    });
  });
});
