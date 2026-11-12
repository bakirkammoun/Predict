import http from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { startMqtt } from "./mqtt/client.js";
import { initSockets } from "./sockets/hub.js";
import { startJobs } from "./jobs/offlineChecker.js";
import { logger } from "./utils/logger.js";
import { startSimulator } from "./services/simulatorService.js";
import { backfillOpenAlertNotifications } from "./services/notificationService.js";

async function main() {
  await connectDb();
  const app = createApp();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: env.CORS_ORIGIN.split(",").map((s) => s.trim()), credentials: true },
  });
  initSockets(io);
  await backfillOpenAlertNotifications();
  startMqtt();
  startJobs();
  if (env.NODE_ENV === "development" && env.SIMULATION_ENABLED && process.env.AUTO_SIM === "true") {
    startSimulator();
  }
  server.listen(env.PORT, () => {
    logger.info(`PrédiMaint API http://localhost:${env.PORT}`);
    logger.info(`OpenAPI http://localhost:${env.PORT}/api/docs`);
  });
}

main().catch((err) => {
  logger.error(err);
  process.exit(1);
});
