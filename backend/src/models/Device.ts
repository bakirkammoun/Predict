import mongoose, { Schema } from "mongoose";

const deviceSchema = new Schema(
  {
    hardwareId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true },
    machineId: { type: Schema.Types.ObjectId, ref: "Machine" },
    secretHash: { type: String, required: true, select: false },
    status: { type: String, enum: ["online", "offline"], default: "offline" },
    lastSeenAt: { type: Date },
    revoked: { type: Boolean, default: false },
    firmwareVersion: { type: String, default: "sim-1.0.0" },
  },
  { timestamps: true },
);

deviceSchema.index({ machineId: 1 });
deviceSchema.index({ revoked: 1, hardwareId: 1 });

deviceSchema.set("toJSON", {
  transform(_doc, ret: Record<string, unknown>) {
    delete ret.secretHash;
    return ret;
  },
});

export const Device = mongoose.model("Device", deviceSchema);
