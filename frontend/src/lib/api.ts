import axios from "axios";

export const api = axios.create({
  baseURL: "/api/v1",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("pm_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.startsWith("/login")) {
      localStorage.removeItem("pm_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  },
);

export type Role = "admin" | "maintenance_manager" | "technician";

export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  phone?: string;
  isActive?: boolean;
}

export function apiError(err: unknown) {
  const ax = err as { response?: { data?: { error?: { message?: string } } } };
  return ax.response?.data?.error?.message ?? "Une erreur est survenue";
}
