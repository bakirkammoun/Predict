import { randomUUID } from "node:crypto";
import { Machine, defaultThresholds } from "../models/Machine.js";
import { Device } from "../models/Device.js";
import { ingestTelemetry } from "./measurementIngestService.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { publishCommand } from "../mqtt/client.js";

type Scenario = "normal" | "warning" | "critical" | "offline" | "sensor_error";

interface SimState {
  running: boolean;
  intervalMs: number;
  timer?: NodeJS.Timeout;
  scenarios: Record<string, Scenario>;
  frequencies: Record<string, number>;
}

const state: SimState = {
  running: false,
  intervalMs: env.SIMULATION_INTERVAL_MS,
  scenarios: {},
  frequencies: {},
};

function jitter(base: number, amp: number) {
  return base + (Math.random() - 0.5) * amp;
}

function valuesFor(scenario: Scenario, raw: InstanceType<typeof Machine>["thresholds"]) {
  const t = raw ?? defaultThresholds;
  if (scenario === "critical") {
    return {
      vibration: jitter(t.vibration.criticalMax + 0.3, 0.15),
      temperature: jitter(t.temperature.criticalMax + 4, 2),
      current: jitter(t.current.criticalMax + 0.8, 0.3),
    };
  }
  if (scenario === "warning") {
    return {
      vibration: jitter((t.vibration.warningMax + t.vibration.criticalMax) / 2, 0.05),
      temperature: jitter((t.temperature.warningMax + t.temperature.criticalMax) / 2, 1.5),
      current: jitter((t.current.warningMax + t.current.criticalMax) / 2, 0.4),
    };
  }
  return {
    vibration: jitter(t.vibration.warningMax * 0.4, 0.08),
    temperature: jitter(Math.max(25, t.temperature.warningMax * 0.55), 3),
    current: jitter(Math.max(2, t.current.warningMax * 0.45), 0.4),
  };
}

async function tick() {
  const machines = await Machine.find({ operationalStatus: "active" }).populate("deviceId");
  for (const machine of machines) {
    const scenario = state.scenarios[String(machine._id)] ?? "normal";
    if (scenario === "offline") continue;
    const device = await Device.findById(machine.deviceId);
    if (!device || device.revoked) continue;
    const skip = state.frequencies[String(machine._id)];
    if (skip && Math.random() > 1 / skip) continue;
    const v = valuesFor(scenario === "sensor_error" ? "normal" : scenario, machine.thresholds);
    await ingestTelemetry(
      {
        deviceId: device.hardwareId,
        machineId: machine.code,
        messageId: randomUUID(),
        timestamp: new Date().toISOString(),
        vibration: { value: Number(v.vibration.toFixed(3)), unit: "g" },
        temperature: {
          value: scenario === "sensor_error" ? -127 : Number(v.temperature.toFixed(2)),
          unit: "C",
        },
        current: { value: Number(v.current.toFixed(2)), unit: "A" },
        source: "simulation",
        sensorErrors: scenario === "sensor_error" ? { temperature: true } : undefined,
      },
      device.hardwareId,
    );
  }
}

export function getSimulatorStatus() {
  return {
    running: state.running,
    intervalMs: state.intervalMs,
    scenarios: state.scenarios,
    note: "Les mesures produites ont source=simulation et ne proviennent pas de capteurs physiques.",
  };
}

export function startSimulator(intervalMs?: number) {
  if (!env.SIMULATION_ENABLED) {
    throw new AppError(403, "Simulateur désactivé dans cet environnement", "SIMULATION_DISABLED");
  }
  if (state.running) return getSimulatorStatus();
  state.intervalMs = intervalMs ?? state.intervalMs;
  state.running = true;
  void tick();
  state.timer = setInterval(() => {
    void tick().catch((err) => logger.error("simulator tick", { err }));
  }, state.intervalMs);
  logger.info("Simulator started", { intervalMs: state.intervalMs });
  return getSimulatorStatus();
}

export function stopSimulator() {
  if (state.timer) clearInterval(state.timer);
  state.timer = undefined;
  state.running = false;
  logger.info("Simulator stopped");
  return getSimulatorStatus();
}

export function setMachineScenario(machineId: string, scenario: Scenario) {
  state.scenarios[machineId] = scenario;
  return getSimulatorStatus();
}

export function setIntervalMs(intervalMs: number) {
  state.intervalMs = intervalMs;
  if (state.running) {
    stopSimulator();
    startSimulator(intervalMs);
  }
  return getSimulatorStatus();
}

export function commandDevice(hardwareId: string, command: string) {
  return publishCommand(hardwareId, { command });
}
