import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { openApiSpec } from "./config/swagger.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { AppError } from "./utils/AppError.js";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { machinesRouter } from "./routes/machines.js";
import { alertsRouter } from "./routes/alerts.js";
import { interventionsRouter } from "./routes/interventions.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { settingsRouter } from "./routes/settings.js";
import { simulationRouter } from "./routes/simulation.js";
import { auditRouter } from "./routes/audit.js";
import { devicesRouter } from "./routes/devices.js";
import { notificationsRouter } from "./routes/notifications.js";
import { profileRouter } from "./routes/profile.js";
import { reportsRouter } from "./routes/reports.js";
import { measurementsRouter } from "./routes/measurements.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(",").map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "512kb" }));
  app.use(
    "/api/v1/auth/login",
    rateLimit({
      windowMs: 15 * 60_000,
      max: 20,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  app.use(
    "/api/v1/auth/register",
    rateLimit({
      windowMs: 60 * 60_000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  app.use(
    "/api/v1/auth/verify-email",
    rateLimit({
      windowMs: 15 * 60_000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.get("/health", (_req, res) =>
    res.json({ ok: true, service: "predimaint-backend" }),
  );
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

  const v1 = env.API_PREFIX;
  app.use(`${v1}/auth`, authRouter);
  app.use(`${v1}/users`, usersRouter);
  app.use(`${v1}/machines`, machinesRouter);
  app.use(`${v1}/alerts`, alertsRouter);
  app.use(`${v1}/interventions`, interventionsRouter);
  app.use(`${v1}/dashboard`, dashboardRouter);
  app.use(`${v1}/settings`, settingsRouter);
  app.use(`${v1}/simulation`, simulationRouter);
  app.use(`${v1}/audit`, auditRouter);
  app.use(`${v1}/devices`, devicesRouter);
  app.use(`${v1}/notifications`, notificationsRouter);
  app.use(`${v1}/profile`, profileRouter);
  app.use(`${v1}/reports`, reportsRouter);
  app.use(`${v1}/measurements`, measurementsRouter);

  app.use((_req, _res, next) =>
    next(new AppError(404, "Ressource introuvable", "NOT_FOUND")),
  );
  app.use(errorHandler);
  return app;
}
