import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function connectSocket() {
  const token = localStorage.getItem("pm_token");
  if (!token) return null;
  if (socket?.connected) return socket;
  socket = io("/", { auth: { token } });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function getSocket() {
  return socket;
}
