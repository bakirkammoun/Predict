import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";

function createTransporter() {
  return nodemailer.createTransport({
    host: env.MAIL_HOST,
    port: env.MAIL_PORT,
    secure: env.MAIL_SECURE,
    ...(env.MAIL_USER
      ? { auth: { user: env.MAIL_USER, pass: env.MAIL_PASSWORD } }
      : {}),
  });
}

function emailFrom() {
  const from = env.MAIL_FROM || env.MAIL_USER;
  if (!env.MAIL_HOST || !from) {
    throw new AppError(
      503,
      "Le service d’envoi d’e-mails n’est pas configuré",
      "EMAIL_NOT_CONFIGURED",
    );
  }
  return from;
}

function deliveryError(
  error: unknown,
  fallbackMessage: string,
  fallbackCode: string,
) {
  logger.error("Verification email delivery failed", { err: error });
  if (
    error &&
    typeof error === "object" &&
    (("code" in error && error.code === "EAUTH") ||
      ("responseCode" in error && error.responseCode === 535))
  ) {
    throw new AppError(
      503,
      "Gmail a refusé l’authentification. Vérifiez MAIL_USER et utilisez le mot de passe d’application Google dans MAIL_PASSWORD.",
      "EMAIL_AUTH_FAILED",
    );
  }
  throw new AppError(503, fallbackMessage, fallbackCode);
}

export async function sendVerificationCode(
  email: string,
  code: string,
  name: string,
) {
  const from = emailFrom();
  try {
    await createTransporter().sendMail({
      from,
      to: email,
      subject: "Votre code de vérification PrédiMaint",
      text: `Bonjour ${name},\n\nVotre code de vérification PrédiMaint est : ${code}\nIl expire dans 10 minutes.\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.`,
    });
  } catch (error) {
    deliveryError(
      error,
      "Impossible d’envoyer le code de vérification",
      "EMAIL_DELIVERY_FAILED",
    );
  }
}

export async function sendAdminApprovalRequest(
  email: string,
  name: string,
  role: "maintenance_manager" | "technician",
) {
  const from = emailFrom();
  const recipient = env.MAIL_ADMIN_EMAIL;
  if (!recipient) {
    throw new AppError(
      503,
      "L’adresse e-mail de l’administrateur n’est pas configurée",
      "ADMIN_EMAIL_NOT_CONFIGURED",
    );
  }

  const roleLabel =
    role === "technician" ? "Technicien" : "Manager maintenance";
  const approvalUrl = new URL("/users", env.CLIENT_URL).toString();
  try {
    await createTransporter().sendMail({
      from,
      to: recipient,
      subject: "Nouveau compte PrédiMaint à approuver",
      text: `Bonjour,\n\n${name} (${email}) a vérifié son adresse et demande un compte ${roleLabel} sur PrédiMaint.\n\nLe compte reste désactivé jusqu’à votre approbation. Connectez-vous avec un compte administrateur pour consulter la demande et l’approuver : ${approvalUrl}\n`,
    });
  } catch (error) {
    deliveryError(
      error,
      "Le compte reste en attente, mais l’e-mail de demande à l’administrateur n’a pas pu être envoyé",
      "ADMIN_EMAIL_DELIVERY_FAILED",
    );
  }
}
