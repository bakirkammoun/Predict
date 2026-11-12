import mongoose, { Schema } from "mongoose";

const systemSettingsSchema = new Schema(
  {
    key: { type: String, default: "global", unique: true },
    offlineTimeoutMs: { type: Number, required: true },
    measurementRetentionDays: { type: Number, required: true },
    confirmationCount: { type: Number, default: 3 },
    hysteresisCount: { type: Number, default: 2 },
  },
  { timestamps: true },
);

export const SystemSettings = mongoose.model("SystemSettings", systemSettingsSchema);
