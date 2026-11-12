import type { Response } from "express";

export function ok<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function paginated<T>(
  res: Response,
  data: T[],
  meta: { page: number; limit: number; total: number },
) {
  return res.status(200).json({
    success: true,
    data,
    meta: {
      ...meta,
      pages: Math.max(1, Math.ceil(meta.total / meta.limit)),
    },
  });
}
