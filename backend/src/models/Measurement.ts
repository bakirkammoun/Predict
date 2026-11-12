import mongoose, { Schema } from "mongoose";

const metricSchema = new Schema(
  {
    value: { type: Number, required: true },
    unit: { type: String, required: true },
  },
  { _id: false },
);

const measurementSchema = new Schema(
  {
    machineId: { type: Schema.Types.ObjectId, ref: "Machine", required: true },
    deviceId: { type: Schema.Types.ObjectId, ref: "Device", required: true },
    hardwareId: { type: String, required: true },
    messageId: { type: String, required: true, unique: true },
    vibration: { type: metricSchema, required: true },
    temperature: { type: metricSchema, required: true },
    humidity: { type: metricSchema },
    current: { type: metricSchema, required: true },
    measuredAt: { type: Date, required: true },
    receivedAt: { type: Date, required: true },
    source: { type: String, enum: ["simulation", "hardware"], required: true },
    validationStatus: { type: String, enum: ["valid", "out_of_range", "sensor_error"], default: "valid" },
    derivedHealth: { type: String, enum: ["normal", "warning", "critical", "sensor_error", "invalid"] },
  },
  { timestamps: false },
);

measurementSchema.index({ machineId: 1, measuredAt: -1 });
measurementSchema.index({ hardwareId: 1, measuredAt: -1 });
measurementSchema.index({ receivedAt: 1 });

export const Measurement = mongoose.model("Measurement", measurementSchema);
