import { describe, expect, it } from "vitest";
import { assertObjectId } from "./ids.js";
import { AppError } from "./AppError.js";

describe("assertObjectId", () => {
  it("accepte un ObjectId MongoDB", () => {
    expect(assertObjectId("507f1f77bcf86cd799439011")).toBe("507f1f77bcf86cd799439011");
  });

  it("refuse un identifiant mal formé", () => {
    expect(() => assertObjectId("not-an-id")).toThrow(AppError);
    try {
      assertObjectId("abc");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).statusCode).toBe(400);
      expect((e as AppError).code).toBe("VALIDATION_ERROR");
    }
  });
});
