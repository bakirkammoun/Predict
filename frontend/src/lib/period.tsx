import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export const PERIODS = [
  { label: "24 h", hours: 24 },
  { label: "7 j", hours: 24 * 7 },
  { label: "30 j", hours: 24 * 30 },
] as const;

interface PeriodState {
  hours: number;
  setHours: (h: number) => void;
  from: Date;
  to: Date;
  query: string;
}

const Ctx = createContext<PeriodState | null>(null);

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [hours, setHours] = useState(() => Number(localStorage.getItem("pm_period") ?? 24));
  const value = useMemo<PeriodState>(() => {
    const to = new Date();
    const from = new Date(to.getTime() - hours * 3600_000);
    return {
      hours,
      setHours: (h: number) => {
        localStorage.setItem("pm_period", String(h));
        setHours(h);
      },
      from,
      to,
      query: `from=${from.toISOString()}&to=${to.toISOString()}`,
    };
  }, [hours]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePeriod() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePeriod");
  return ctx;
}
