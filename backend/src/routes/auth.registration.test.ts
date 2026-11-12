import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { PendingRegistration } from "../models/PendingRegistration.js";
import { User } from "../models/User.js";
import { hashPassword } from "../services/authService.js";
import {
  clearTestDb,
  connectTestDb,
  disconnectTestDb,
} from "../tests/mongo.js";

const mailState = vi.hoisted(() => ({ code: "", approvalRequests: 0 }));

vi.mock("../services/emailService.js", () => ({
  sendVerificationCode: vi.fn(async (_email: string, code: string) => {
    mailState.code = code;
  }),
  sendAdminApprovalRequest: vi.fn(async () => {
    mailState.approvalRequests += 1;
  }),
}));

const app = createApp();

beforeAll(async () => {
  await connectTestDb();
}, 120_000);

afterAll(async () => {
  await disconnectTestDb();
});

beforeEach(async () => {
  mailState.code = "";
  mailState.approvalRequests = 0;
  await clearTestDb();
});

describe("inscription et vérification e-mail", () => {
  it.each(["maintenance_manager", "technician"])(
    "crée un compte %s seulement après vérification",
    async (role) => {
      const email = `${role}@example.com`;
      const registration = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email,
          password: "A-strong-password-123",
          firstName: "Prénom",
          lastName: "Nom",
          role,
        });

      expect(registration.status).toBe(202);
      expect(registration.body.data).toEqual({ email, expiresInMinutes: 10 });
      expect(registration.body.data).not.toHaveProperty("code");
      expect(mailState.code).toMatch(/^\d{6}$/);
      expect(await User.countDocuments()).toBe(0);
      expect(await PendingRegistration.countDocuments()).toBe(1);

      const verified = await request(app)
        .post("/api/v1/auth/verify-email")
        .send({ email, code: mailState.code });

      expect(verified.status).toBe(202);
      expect(verified.body.data).toEqual({
        email,
        approvalRequired: true,
      });
      expect(verified.body.data.token).toBeUndefined();
      expect(mailState.approvalRequests).toBe(1);
      expect(await User.countDocuments({ email })).toBe(1);
      expect(
        await User.exists({
          email,
          isActive: false,
          approvalStatus: "pending",
        }),
      ).toBeTruthy();
      expect(await PendingRegistration.countDocuments()).toBe(0);

      const login = await request(app)
        .post("/api/v1/auth/login")
        .send({ email, password: "A-strong-password-123" });
      expect(login.status).toBe(403);
      expect(login.body.error.code).toBe("ACCOUNT_PENDING_APPROVAL");
    },
  );

  it("permet uniquement à un administrateur d’approuver puis activer le compte", async () => {
    const userPassword = "A-strong-password-123";
    const [admin, manager, pending] = await User.create([
      {
        email: "admin@example.com",
        passwordHash: await hashPassword("Another-strong-password-123"),
        firstName: "Admin",
        lastName: "User",
        role: "admin",
      },
      {
        email: "manager@example.com",
        passwordHash: await hashPassword(userPassword),
        firstName: "Manager",
        lastName: "User",
        role: "maintenance_manager",
      },
      {
        email: "pending@example.com",
        passwordHash: await hashPassword(userPassword),
        firstName: "Pending",
        lastName: "User",
        role: "technician",
        isActive: false,
        approvalStatus: "pending",
      },
    ]);

    const adminLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: admin.email, password: "Another-strong-password-123" });
    const managerLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: manager.email, password: userPassword });

    const forbidden = await request(app)
      .post(`/api/v1/users/${pending.id}/approve`)
      .set("Authorization", `Bearer ${managerLogin.body.data.token}`);
    expect(forbidden.status).toBe(403);

    const listed = await request(app)
      .get("/api/v1/users/pending-approval")
      .set("Authorization", `Bearer ${adminLogin.body.data.token}`);
    expect(listed.status).toBe(200);
    expect(
      listed.body.data.map((user: { email: string }) => user.email),
    ).toContain(pending.email);

    const approved = await request(app)
      .post(`/api/v1/users/${pending.id}/approve`)
      .set("Authorization", `Bearer ${adminLogin.body.data.token}`);
    expect(approved.status).toBe(200);
    expect(approved.body.data.isActive).toBe(true);
    expect(approved.body.data.approvalStatus).toBe("approved");

    const userLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: pending.email, password: userPassword });
    expect(userLogin.status).toBe(200);
    expect(userLogin.body.data.token).toBeTruthy();
  });

  it("refuse l’inscription publique en tant qu’administrateur", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      email: "admin@example.com",
      password: "A-strong-password-123",
      firstName: "Admin",
      lastName: "User",
      role: "admin",
    });

    expect(response.status).toBe(400);
    expect(await User.countDocuments()).toBe(0);
  });

  it("refuse un code incorrect sans créer de compte", async () => {
    await request(app).post("/api/v1/auth/register").send({
      email: "tech@example.com",
      password: "A-strong-password-123",
      firstName: "Tech",
      lastName: "User",
      role: "technician",
    });

    const response = await request(app)
      .post("/api/v1/auth/verify-email")
      .send({ email: "tech@example.com", code: "000000" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_VERIFICATION_CODE");
    expect(await User.countDocuments()).toBe(0);
  });

  it("bloque les tentatives répétées de code", async () => {
    await request(app).post("/api/v1/auth/register").send({
      email: "tech@example.com",
      password: "A-strong-password-123",
      firstName: "Tech",
      lastName: "User",
      role: "technician",
    });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app)
        .post("/api/v1/auth/verify-email")
        .send({ email: "tech@example.com", code: "000000" });
    }

    const response = await request(app)
      .post("/api/v1/auth/verify-email")
      .send({ email: "tech@example.com", code: mailState.code });

    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe("VERIFICATION_RATE_LIMIT");
  });
});
