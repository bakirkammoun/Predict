import mongoose, { Schema } from "mongoose";

export const INTERVENTION_STATUSES = [
  "planned",
  "todo",
  "in_progress",
  "on_hold",
  "completed",
  "cancelled",
] as const;
export type InterventionStatus = (typeof INTERVENTION_STATUSES)[number];

export const INTERVENTION_TRANSITIONS: Record<InterventionStatus, InterventionStatus[]> = {
  planned: ["todo", "in_progress", "cancelled"],
  todo: ["planned", "in_progress", "cancelled"],
  in_progress: ["on_hold", "completed", "cancelled"],
  on_hold: ["in_progress", "cancelled"],
  completed: [],
  cancelled: [],
};

const partSchema = new Schema(
  {
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const historySchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true },
    fromStatus: { type: String },
    toStatus: { type: String },
    note: { type: String, default: "" },
  },
  { _id: false },
);

const interventionSchema = new Schema(
  {
    reference: { type: String, required: true, unique: true },
    machineId: { type: Schema.Types.ObjectId, ref: "Machine", required: true },
    alertId: { type: Schema.Types.ObjectId, ref: "Alert" },
    type: { type: String, enum: ["corrective", "preventive", "inspection"], required: true },
    problemDescription: { type: String, required: true },
    priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium" },
    assignedTechnicianId: { type: Schema.Types.ObjectId, ref: "User" },
    scheduledAt: { type: Date },
    startedAt: { type: Date },
    endedAt: { type: Date },
    status: { type: String, enum: INTERVENTION_STATUSES, default: "planned" },
    diagnosis: { type: String, default: "" },
    actions: { type: String, default: "" },
    parts: { type: [partSchema], default: [] },
    estimatedCost: { type: Number },
    actualCost: { type: Number },
    observations: { type: String, default: "" },
    history: { type: [historySchema], default: [] },
  },
  { timestamps: true },
);

interventionSchema.index({ machineId: 1, status: 1, scheduledAt: 1 });
interventionSchema.index({ assignedTechnicianId: 1, status: 1 });
interventionSchema.index({ scheduledAt: 1 });

export const Intervention = mongoose.model("Intervention", interventionSchema);
