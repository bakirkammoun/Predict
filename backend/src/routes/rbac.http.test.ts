import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";

describe("protection des routes", () => {
  it("exige un jeton pour /api/v1/machines", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/machines");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBeDefined();
  });

  it("exige un jeton pour /api/v1/alerts", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/alerts");
    expect(res.status).toBe(401);
  });

  it("exige un jeton pour mesures et interventions", async () => {
    const app = createApp();
    expect((await request(app).get("/api/v1/measurements")).status).toBe(401);
    expect((await request(app).get("/api/v1/interventions")).status).toBe(401);
    expect((await request(app).get("/api/v1/users")).status).toBe(401);
    expect((await request(app).get("/api/v1/dashboard/summary")).status).toBe(401);
  });

  it("refuse un jeton mal formé", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/machines").set("Authorization", "Bearer not-a-jwt");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
  });
});
