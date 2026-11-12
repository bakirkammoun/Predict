import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";

describe("GET /health", () => {
  it("répond sans authentification", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("répond 404 pour une ressource inconnue", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("valide le corps de login sans divulguer de détail interne", async () => {
    const app = createApp();
    const res = await request(app).post("/api/v1/auth/login").send({ email: "pas-un-email" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|JWT_SECRET|stack/i);
  });
});
