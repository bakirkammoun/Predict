import mongoose, { Schema } from "mongoose";

export const HEALTH_STATUSES = ["normal", "warning", "critical", "sensor_error", "offline"] as const;
export type HealthStatus = (typeof HEALTH_STATUSES)[number];
export const OPERATIONAL_STATUSES = ["active", "inactive"] as const;

const metricThresholdSchema = new Schema(
  {
    unit: { type: String, required: true },
    validMin: { type: Number, required: true },
    validMax: { type: Number, required: true },
    warningMin: { type: Number },
    warningMax: { type: Number, required: true },
    criticalMin: { type: Number },
    criticalMax: { type: Number, required: true },
  },
  { _id: false },
);

const metricHealthSchema = new Schema(
  {
    vibration: { type: String, enum: ["normal", "warning", "critical"], default: "normal" },
    temperature: { type: String, enum: ["normal", "warning", "critical"], default: "normal" },
    current: { type: String, enum: ["normal", "warning", "critical"], default: "normal" },
  },
  { _id: false },
);

const machineSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: "" },
    type: { type: String, required: true },
    brand: { type: String, default: "" },
    model: { type: String, default: "" },
    location: { type: String, required: true },
    commissionedAt: { type: Date },
    operationalStatus: { type: String, enum: OPERATIONAL_STATUSES, default: "active" },
    healthStatus: { type: String, enum: HEALTH_STATUSES, default: "offline" },
    metricHealth: { type: metricHealthSchema, default: undefined },
    deviceId: { type: Schema.Types.ObjectId, ref: "Device" },
    lastCommunicationAt: { type: Date },
    assignedTechnicianId: { type: Schema.Types.ObjectId, ref: "User" },
    confirmationCount: { type: Number, default: 3 },
    hysteresisCount: { type: Number, default: 2 },
    consecutive: {
      vibration: {
        warning: { type: Number, default: 0 },
        critical: { type: Number, default: 0 },
        normal: { type: Number, default: 0 },
      },
      temperature: {
        warning: { type: Number, default: 0 },
        critical: { type: Number, default: 0 },
        normal: { type: Number, default: 0 },
      },
      current: {
        warning: { type: Number, default: 0 },
        critical: { type: Number, default: 0 },
        normal: { type: Number, default: 0 },
      },
    },
    thresholds: {
      vibration: { type: metricThresholdSchema, required: true },
      temperature: { type: metricThresholdSchema, required: true },
      current: { type: metricThresholdSchema, required: true },
    },
    heuristicRisk: { type: Number, default: 0 },
  },
  { timestamps: true },
);

machineSchema.index({ location: 1, type: 1 });
machineSchema.index({ healthStatus: 1, operationalStatus: 1 });
machineSchema.index({ assignedTechnicianId: 1 });
machineSchema.index({ name: "text", code: "text" });

export const Machine = mongoose.model("Machine", machineSchema);

export const defaultThresholds = {
  vibration: {
    unit: "g",
    validMin: 0,
    validMax: 20,
    warningMax: 0.8,
    criticalMax: 1.5,
  },
  temperature: {
    unit: "C",
    validMin: -20,
    validMax: 150,
    warningMax: 70,
    criticalMax: 90,
  },
  current: {
    unit: "A",
    validMin: 0,
    validMax: 100,
    warningMin: 1.5,
    warningMax: 8,
    criticalMin: 0.5,
    criticalMax: 12,
  },
};
