import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

export async function connectDb() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGO_URI);
  const host = env.MONGO_URI.includes("@") ? env.MONGO_URI.split("@")[1]?.split("/")[0] : "local";
  logger.info("MongoDB connected", { host });
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
