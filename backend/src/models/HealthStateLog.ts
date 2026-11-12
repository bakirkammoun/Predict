import mongoose, { Schema } from "mongoose";

const healthStateLogSchema = new Schema(
  {
    machineId: { type: Schema.Types.ObjectId, ref: "Machine", required: true },
    fromStatus: { type: String, required: true },
    toStatus: { type: String, required: true },
    at: { type: Date, required: true },
    reason: { type: String, default: "" },
  },
  { timestamps: false },
);

healthStateLogSchema.index({ machineId: 1, at: -1 });

export const HealthStateLog = mongoose.model("HealthStateLog", healthStateLogSchema);
