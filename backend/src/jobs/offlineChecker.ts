import { SystemSettings } from "../models/SystemSettings.js";
import { env } from "../config/env.js";
import { markMachinesOffline } from "../services/measurementIngestService.js";
import { logger } from "../utils/logger.js";
import { Measurement } from "../models/Measurement.js";

export function startJobs() {
  setInterval(() => {
    void (async () => {
      const settings = await SystemSettings.findOne({ key: "global" });
      await markMachinesOffline(settings?.offlineTimeoutMs ?? env.OFFLINE_TIMEOUT_MS);
    })().catch((err) => logger.error("offline job", { err }));
  }, 30_000);

  setInterval(() => {
    void (async () => {
      const settings = await SystemSettings.findOne({ key: "global" });
      const days = settings?.measurementRetentionDays ?? env.MEASUREMENT_RETENTION_DAYS;
      await purgeOldMeasurements(days);
    })().catch((err) => logger.error("retention job", { err }));
  }, 6 * 3600_000);
}

export async function purgeOldMeasurements(days: number) {
  const cutoff = new Date(Date.now() - days * 24 * 3600_000);
  const result = await Measurement.deleteMany({ receivedAt: { $lt: cutoff } });
  return result.deletedCount ?? 0;
}
