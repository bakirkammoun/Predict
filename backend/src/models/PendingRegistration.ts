import mongoose, { Schema } from "mongoose";
import { ROLES } from "./User.js";

const pendingRegistrationSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, default: "" },
    role: {
      type: String,
      enum: ROLES.filter((role) => role !== "admin"),
      required: true,
    },
    codeHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
    failedAttempts: { type: Number, default: 0 },
  },
  { timestamps: true },
);

pendingRegistrationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PendingRegistration = mongoose.model(
  "PendingRegistration",
  pendingRegistrationSchema,
);
