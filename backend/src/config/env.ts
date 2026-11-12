import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
dotenv.config({ path: path.join(rootDir, ".env") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

if (process.env.MONGODB_URI) {
  process.env.MONGO_URI = process.env.MONGODB_URI;
}
if (process.env.MQTT_BROKER_URL && !process.env.MQTT_URL) {
  process.env.MQTT_URL = process.env.MQTT_BROKER_URL;
}
if (process.env.CLIENT_URL && !process.env.CORS_ORIGIN) {
  process.env.CORS_ORIGIN = process.env.CLIENT_URL;
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(4000),
  API_PREFIX: z.string().default("/api/v1"),
  MONGO_URI: z.string().default("mongodb://127.0.0.1:27017/predimaint"),
  JWT_SECRET: z.string().min(16).default("dev-only-change-me-please"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  MAIL_HOST: z.string().optional().default(""),
  MAIL_PORT: z.coerce.number().default(587),
  MAIL_SECURE: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  MAIL_USER: z.string().optional().default(""),
  MAIL_PASSWORD: z.string().optional().default(""),
  MAIL_FROM: z.string().optional().default(""),
  MAIL_ADMIN_EMAIL: z.string().optional().default(""),
  CLIENT_URL: z.string().default("http://localhost:5173"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  MQTT_URL: z.string().default("mqtt://127.0.0.1:1883"),
  MQTT_USERNAME: z.string().optional().default(""),
  MQTT_PASSWORD: z.string().optional().default(""),
  MQTT_CLIENT_ID: z.string().default("predimaint-backend"),
  OFFLINE_TIMEOUT_MS: z.coerce.number().default(120_000),
  MEASUREMENT_RETENTION_DAYS: z.coerce.number().default(90),
  ALERT_REOPEN_COOLDOWN_MS: z.coerce.number().default(300_000),
  SEED_PASSWORD: z.string().default("12345678"),
  SEED_ON_START: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  ADMIN_BOOTSTRAP_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== "false"),
  SIMULATION_ENABLED: z.string().optional(),
  SIMULATION_INTERVAL_MS: z.coerce.number().default(4000),
});

const parsed = envSchema.parse(process.env);
const simulationEnabled =
  parsed.NODE_ENV === "production"
    ? parsed.SIMULATION_ENABLED === "true"
    : parsed.SIMULATION_ENABLED !== "false";

export const env = {
  ...parsed,
  MAIL_ADMIN_EMAIL: parsed.MAIL_ADMIN_EMAIL || parsed.MAIL_USER,
  SIMULATION_ENABLED: simulationEnabled,
};
export const isProd = env.NODE_ENV === "production";
