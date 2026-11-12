import { beforeEach, describe, expect, it, vi } from "vitest";

const mailState = vi.hoisted(() => ({
  sendMail: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({ sendMail: mailState.sendMail }),
  },
}));

vi.mock("../config/env.js", () => ({
  env: {
    MAIL_HOST: "smtp.test",
    MAIL_PORT: 587,
    MAIL_SECURE: false,
    MAIL_USER: "sender@example.com",
    MAIL_PASSWORD: "test-password",
    MAIL_FROM: "sender@example.com",
    MAIL_ADMIN_EMAIL: "admin@example.com",
    CLIENT_URL: "http://localhost:5173",
  },
}));

import {
  sendAdminApprovalRequest,
  sendVerificationCode,
} from "./emailService.js";

describe("envoi du code de vérification", () => {
  beforeEach(() => {
    mailState.sendMail.mockReset();
  });

  it("explique comment corriger un refus d’authentification Gmail", async () => {
    mailState.sendMail.mockRejectedValue(
      Object.assign(new Error("Authentication failed"), {
        code: "EAUTH",
        responseCode: 535,
      }),
    );

    await expect(
      sendVerificationCode("technician@example.com", "123456", "Tech"),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: "EMAIL_AUTH_FAILED",
      message: expect.stringContaining("mot de passe d’application Google"),
    });
  });

  it("envoie la demande d’approbation à l’adresse de l’administrateur", async () => {
    mailState.sendMail.mockResolvedValue({ messageId: "test-message" });

    await sendAdminApprovalRequest(
      "tech@example.com",
      "Tech User",
      "technician",
    );

    expect(mailState.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin@example.com",
        subject: "Nouveau compte PrédiMaint à approuver",
      }),
    );
    expect(mailState.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("tech@example.com"),
      }),
    );
  });
});
