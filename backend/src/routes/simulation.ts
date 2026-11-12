import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middlewares/auth.js";
import { authorize } from "../middlewares/rbac.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { ok } from "../utils/apiResponse.js";
import {
  commandDevice,
  getSimulatorStatus,
  setIntervalMs,
  setMachineScenario,
  startSimulator,
  stopSimulator,
} from "../services/simulatorService.js";
import { audit } from "../services/auditService.js";
import { Device } from "../models/Device.js";
import { AppError } from "../utils/AppError.js";

export const simulationRouter = Router();
simulationRouter.use(authenticate, authorize("admin", "maintenance_manager"));

simulationRouter.get("/", (_req, res) => ok(res, getSimulatorStatus()));

simulationRouter.post(
  "/start",
  asyncHandler(async (req, res) => {
    const intervalMs = req.body?.intervalMs ? Number(req.body.intervalMs) : undefined;
    const data = startSimulator(intervalMs);
    await audit(req, "simulation.start", "simulation");
    ok(res, data);
  }),
);

simulationRouter.post(
  "/stop",
  asyncHandler(async (req, res) => {
    const data = stopSimulator();
    await audit(req, "simulation.stop", "simulation");
    ok(res, data);
  }),
);

simulationRouter.post(
  "/scenario",
  asyncHandler(async (req, res) => {
    const { machineId, scenario } = z
      .object({
        machineId: z.string(),
        scenario: z.enum(["normal", "warning", "critical", "offline", "sensor_error"]),
      })
      .parse(req.body);
    const data = setMachineScenario(machineId, scenario);
    await audit(req, "simulation.scenario", "machine", machineId, { scenario });
    ok(res, data);
  }),
);

simulationRouter.post(
  "/interval",
  asyncHandler(async (req, res) => {
    const { intervalMs } = z.object({ intervalMs: z.number().min(500).max(60_000) }).parse(req.body);
    ok(res, setIntervalMs(intervalMs));
  }),
);

simulationRouter.post(
  "/disconnect",
  asyncHandler(async (req, res) => {
    const { machineId } = z.object({ machineId: z.string() }).parse(req.body);
    ok(res, setMachineScenario(machineId, "offline"));
  }),
);

simulationRouter.post(
  "/command",
  asyncHandler(async (req, res) => {
    const { hardwareId, command } = z
      .object({ hardwareId: z.string(), command: z.string() })
      .parse(req.body);
    const device = await Device.findOne({ hardwareId, revoked: false });
    if (!device) throw new AppError(404, "Appareil introuvable", "NOT_FOUND");
    const sent = commandDevice(hardwareId, command);
    ok(res, { sent, note: sent ? "Commande publiée MQTT" : "Broker MQTT indisponible" });
  }),
);
