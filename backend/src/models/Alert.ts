import mongoose, { Schema } from "mongoose";

export const ALERT_STATUSES = ["new", "acknowledged", "in_progress", "resolved"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const ALERT_TRANSITIONS: Record<AlertStatus, AlertStatus[]> = {
  new: ["acknowledged", "in_progress", "resolved"],
  acknowledged: ["in_progress", "resolved"],
  in_progress: ["resolved", "acknowledged"],
  resolved: [],
};
export const ALERT_SEVERITIES = ["warning", "critical"] as const;
export const ALERT_PARAMETERS = ["vibration", "temperature", "current", "connectivity"] as const;

const alertSchema = new Schema(
  {
    machineId: { type: Schema.Types.ObjectId, ref: "Machine", required: true },
    fingerprint: { type: String, required: true },
    type: { type: String, required: true },
    parameter: { type: String, enum: ALERT_PARAMETERS, required: true },
    observedValue: { type: Number },
    threshold: { type: Number },
    unit: { type: String, default: "" },
    severity: { type: String, enum: ALERT_SEVERITIES, required: true },
    detectedAt: { type: Date, required: true },
    description: { type: String, required: true },
    status: { type: String, enum: ALERT_STATUSES, default: "new" },
    acknowledgedBy: { type: Schema.Types.ObjectId, ref: "User" },
    acknowledgedAt: { type: Date },
    resolvedAt: { type: Date },
    interventionId: { type: Schema.Types.ObjectId, ref: "Intervention" },
    source: { type: String, enum: ["simulation", "hardware"], default: "simulation" },
  },
  { timestamps: true },
);

alertSchema.index({ machineId: 1, status: 1, detectedAt: -1 });
alertSchema.index({ fingerprint: 1, status: 1 });
alertSchema.index({ status: 1, severity: 1 });

export const Alert = mongoose.model("Alert", alertSchema);
