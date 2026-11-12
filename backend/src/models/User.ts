import mongoose, { Schema } from "mongoose";

export const ROLES = ["admin", "maintenance_manager", "technician"] as const;
export type Role = (typeof ROLES)[number];

const userSchema = new Schema(
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
    role: { type: String, enum: ROLES, required: true },
    isActive: { type: Boolean, default: true },
    approvalStatus: {
      type: String,
      enum: ["approved", "pending"],
      default: "approved",
    },
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

userSchema.index({ role: 1, isActive: 1 });

function stripSecret(_doc: unknown, ret: Record<string, unknown>) {
  delete ret.passwordHash;
  return ret;
}

userSchema.set("toJSON", { transform: stripSecret });
userSchema.set("toObject", { transform: stripSecret });

export const User = mongoose.model("User", userSchema);
