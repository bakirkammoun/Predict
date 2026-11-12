import { describe, expect, it } from "vitest";
import type { Request, Response } from "express";
import { authorize } from "./rbac.js";
import { AppError } from "../utils/AppError.js";

describe("authorize", () => {
  it("refuse un technicien sur une route admin", () => {
    const mw = authorize("admin");
    const req = { user: { id: "1", role: "technician", email: "t@x" } } as Request;
    expect(() => mw(req, {} as Response, () => undefined)).toThrow(AppError);
  });

  it("autorise un administrateur", () => {
    const mw = authorize("admin");
    let called = false;
    const req = { user: { id: "1", role: "admin", email: "a@x" } } as Request;
    mw(req, {} as Response, () => {
      called = true;
    });
    expect(called).toBe(true);
  });
});
