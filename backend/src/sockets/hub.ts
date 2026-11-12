import type { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { JwtPayload } from "../middlewares/auth.js";
import { User } from "../models/User.js";
import { accessibleMachineIds } from "../services/scopeService.js";
import { logger } from "../utils/logger.js";

let ioRef: Server | null = null;

export function initSockets(io: Server) {
  ioRef = io;
  io.use(async (socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ||
        (socket.handshake.headers.authorization?.toString().replace("Bearer ", "") ?? "");
      if (!token) return next(new Error("UNAUTHENTICATED"));
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      const user = await User.findById(payload.sub).select("role email isActive tokenVersion");
      if (!user || !user.isActive || (payload.tv ?? 0) !== (user.tokenVersion ?? 0)) {
        return next(new Error("UNAUTHENTICATED"));
      }
      const machineIds = await accessibleMachineIds({ id: String(user._id), role: user.role });
      socket.data.user = { id: String(user._id), role: user.role, email: user.email };
      socket.data.machineIds = machineIds.map(String);
      next();
    } catch {
      next(new Error("UNAUTHENTICATED"));
    }
  });

  io.on("connection", (socket) => {
    const rooms = (socket.data.machineIds as string[]).map((id) => `machine:${id}`);
    rooms.push(`user:${socket.data.user.id}`);
    if (socket.data.user.role !== "technician") rooms.push("ops");
    socket.join(rooms);
    logger.debug("socket connected", { user: socket.data.user.email });
  });
}

export function emitToMachine(machineId: string, event: string, payload: unknown) {
  ioRef?.to(`machine:${machineId}`).emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  ioRef?.to(`user:${userId}`).emit(event, payload);
}

export function emitToOps(event: string, payload: unknown) {
  ioRef?.to("ops").emit(event, payload);
}
