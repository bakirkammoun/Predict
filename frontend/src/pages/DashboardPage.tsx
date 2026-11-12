import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowUpRight, Factory, Gauge, Wrench } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../lib/api";
import { StatCard } from "../components/StatCard";
import { Badge } from "../components/Badge";
import { Empty } from "../components/Empty";
import { pct, when } from "../lib/format";
import { usePeriod } from "../lib/period";
import { connectSocket } from "../lib/socket";
import { useAuth } from "../lib/auth";
import { IndustrialBanner } from "../components/IndustrialBanner";

const STATUS_COLORS = {
  normal: "#16a34a",
  warning: "#f59e0b",
  critical: "#dc2626",
  offline: "#94a3b8",
  sensorError: "#0d9488",
};

type TrendPoint = {
  _id: string;
  vibration: number;
  temperature: number;
  humidity?: number | null;
  current: number;
};

function AvailabilityGauge({ value }: { value: number }) {
  const percentage = Math.max(0, Math.min(100, value * 100));
  const length = 251.33;

  return (
    <div className="availability-gauge">
      <svg viewBox="0 0 200 112" role="img" aria-label={`Disponibilité ${pct(value)}`}>
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke="#eeedf5"
          strokeWidth="15"
          strokeLinecap="round"
        />
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke="#2563eb"
          strokeWidth="15"
          strokeLinecap="round"
          strokeDasharray={`${(percentage / 100) * length} ${length}`}
        />
      </svg>
      <div className="availability-gauge-value">
        <strong>{pct(value)}</strong>
        <span>Disponibilité</span>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { hours } = usePeriod();
  const { user } = useAuth();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [events, setEvents] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let disposed = false;
    let refreshing = false;
    let refreshPending = false;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      if (refreshing) {
        refreshPending = true;
        return;
      }
      refreshing = true;
      const to = new Date();
      const from = new Date(to.getTime() - hours * 3600_000);
      try {
        const [summary, activity] = await Promise.all([
          api.get(`/dashboard/summary?from=${from.toISOString()}&to=${to.toISOString()}`),
          api.get("/dashboard/events"),
        ]);
        if (!disposed) {
          setData(summary.data.data);
          setEvents(activity.data.data ?? []);
          setError("");
        }
      } catch {
        if (!disposed) setError("Impossible de charger le tableau de bord");
      } finally {
        refreshing = false;
        if (!disposed) setLoading(false);
        if (refreshPending && !disposed) {
          refreshPending = false;
          void load();
        }
      }
    };

    const scheduleLoad = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => void load(), 300);
    };

    void load();
    const s = connectSocket();
    const eventsToRefresh = [
      "measurement:new",
      "alert:new",
      "alert:updated",
      "machine:status",
      "intervention:updated",
    ];
    eventsToRefresh.forEach((event) => s?.on(event, scheduleLoad));
    s?.on("connect", scheduleLoad);
    const interval = setInterval(scheduleLoad, 30_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") scheduleLoad();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      disposed = true;
      clearInterval(interval);
      if (debounceTimer) clearTimeout(debounceTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      eventsToRefresh.forEach((event) => s?.off(event, scheduleLoad));
      s?.off("connect", scheduleLoad);
    };
  }, [hours]);

  if (loading) return <p>Chargement des indicateurs…</p>;
  if (error && !data) return <p className="text-red-600">{error}</p>;
  if (!data) return <Empty title="Aucune donnée" hint="Lancez le seed puis le simulateur." />;

  const counts = data.counts as Record<string, number>;
  const trend = (data.trend as TrendPoint[]) ?? [];
  const alerts = (data.latestAlerts as Record<string, unknown>[]) ?? [];
  const meas = (data.latestMeasurements as Record<string, unknown>[]) ?? [];
  const availability = Number(data.availability) || 0;
  const total = Number(counts.total) || 0;
  const statuses = [
    { label: "Normales", value: Number(counts.normal) || 0, color: STATUS_COLORS.normal },
    { label: "Vigilance", value: Number(counts.warning) || 0, color: STATUS_COLORS.warning },
    { label: "Critiques", value: Number(counts.critical) || 0, color: STATUS_COLORS.critical },
    { label: "Hors ligne", value: Number(counts.offline) || 0, color: STATUS_COLORS.offline },
    { label: "Erreur capteur", value: Number(counts.sensorError) || 0, color: STATUS_COLORS.sensorError },
  ];

  return (
    <div className="dashboard-content">
      <section className="dashboard-heading flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[27px] font-bold tracking-tight">
            Bonjour{user?.firstName ? `, ${user.firstName}` : ""} !
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Voici l’état de votre parc et les dernières activités de maintenance.
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-anthracite dark:ring-slate-700">
          Mise à jour en temps réel
        </span>
      </section>
      <IndustrialBanner />
      {error && <p className="text-sm text-red-600">{error} — affichage des dernières données chargées.</p>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Équipements du parc" value={total} icon={Factory} hint="Machines enregistrées, y compris hors service" accent="violet" />
        <StatCard title="Alertes actives" value={Number(data.activeAlerts)} icon={AlertTriangle} hint="À examiner par l’équipe" accent="blue" />
        <StatCard title="Interventions en cours" value={Number(data.interventionsInProgress)} icon={Wrench} hint="Suivi par les techniciens" accent="orange" />
        <StatCard
          title="Disponibilité moyenne"
          value={pct(availability)}
          icon={Gauge}
          hint={`Sur la période · ${Number(data.availabilityMachineCount) || 0} machine(s) en service`}
          accent="green"
        />
      </section>

      {Number(data.interventionsOverdue) > 0 && (
        <Link
          to="/interventions"
          className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 transition hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <span>Des interventions nécessitent votre attention</span>
          <strong>{Number(data.interventionsOverdue)} en retard</strong>
        </Link>
      )}

      <div className="dashboard-columns">
        <div className="dashboard-primary">
          <section className="surface-card dashboard-chart-card p-5 md:p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Tendance des capteurs</h2>
                <p className="mt-1 text-sm text-slate-500">Évolution moyenne des mesures sur la période</p>
              </div>
              <Link
                className="dashboard-icon-button"
                to="/measurements"
                aria-label="Consulter toutes les mesures"
                title="Consulter toutes les mesures"
              >
                <ArrowUpRight size={19} />
              </Link>
            </div>
            <div className="dashboard-chart-legend">
              <span><i className="legend-dot legend-temperature" />Température (°C)</span>
              <span><i className="legend-dot legend-vibration" />Vibration (détection)</span>
              <span><i className="legend-dot legend-current" />Courant (A)</span>
            </div>
            {trend.length === 0 ? (
              <Empty title="Pas de série temporelle" hint="Démarrez la simulation pour générer des mesures." />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={trend} margin={{ top: 10, right: 4, left: -18, bottom: 2 }}>
                  <defs>
                    <linearGradient id="temperatureFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.015} />
                    </linearGradient>
                    <linearGradient id="currentFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0d9488" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0.01} />
                    </linearGradient>
                    <linearGradient id="vibrationFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#efedf5" strokeDasharray="3 6" vertical={false} />
                  <XAxis
                    dataKey="_id"
                    axisLine={false}
                    tickLine={false}
                    minTickGap={28}
                    tick={{ fill: "#9696a2", fontSize: 11 }}
                    tickFormatter={(value: string) =>
                      new Date(value).toLocaleString("fr-FR", hours > 24 ? {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      } : { hour: "2-digit", minute: "2-digit" })
                    }
                  />
                  <YAxis
                    yAxisId="temperature"
                    axisLine={false}
                    tickLine={false}
                    width={48}
                    tick={{ fill: "#9696a2", fontSize: 11 }}
                  />
                  <YAxis yAxisId="current" orientation="right" hide domain={["auto", "auto"]} />
                  <YAxis yAxisId="vibration" orientation="right" hide domain={[0, 1]} />
                  <Tooltip
                    contentStyle={{
                      border: "1px solid #eeedf5",
                      borderRadius: 14,
                      boxShadow: "0 10px 30px rgba(44, 39, 79, .1)",
                    }}
                    labelFormatter={(value) => when(String(value))}
                  />
                  <Area
                    yAxisId="temperature"
                    type="monotone"
                    dataKey="temperature"
                    name="Température (°C)"
                    stroke="#2563eb"
                    strokeWidth={3}
                    fill="url(#temperatureFill)"
                    activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                    connectNulls
                  />
                  <Area
                    yAxisId="current"
                    type="monotone"
                    dataKey="current"
                    name="Courant (A)"
                    stroke="#0d9488"
                    strokeWidth={2.5}
                    fill="url(#currentFill)"
                    activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                    connectNulls
                  />
                  <Area
                    yAxisId="vibration"
                    type="stepAfter"
                    dataKey="vibration"
                    name="Vibration (détection)"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    fill="url(#vibrationFill)"
                    activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </section>
        </div>

        <aside className="dashboard-aside">
          <section className="surface-card dashboard-status-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold">Disponibilité du parc</h2>
                <p className="mt-1 text-xs text-slate-500">Sur la période sélectionnée</p>
              </div>
              <span className="dashboard-soft-icon"><Gauge size={18} /></span>
            </div>
            <AvailabilityGauge value={availability} />
            <p className="text-center text-xs text-slate-500">
              Machines saines ou en vigilance, en moyenne.
            </p>
            <Link to="/reports" className="dashboard-secondary-button mt-5">Voir les rapports</Link>
          </section>

        </aside>
      </div>

      <section className="surface-card p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Alertes récentes</h2>
              <p className="mt-1 text-xs text-slate-500">Dernières anomalies détectées sur votre parc</p>
            </div>
            <Link className="text-sm font-semibold text-brand hover:underline" to="/alerts">Toutes les alertes</Link>
          </div>
          {alerts.length === 0 ? (
            <Empty title="Aucune alerte récente" />
          ) : (
            <div className="overflow-x-auto">
              <table className="dashboard-table w-full text-left text-sm">
                <thead>
                  <tr>
                    <th>Machine</th>
                    <th>Paramètre</th>
                    <th>Détectée</th>
                    <th>Gravité</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.slice(0, 5).map((alert) => (
                    <tr key={String(alert._id)}>
                      <td className="font-medium">{(alert.machineId as { name?: string })?.name ?? "Machine"}</td>
                      <td>{String(alert.parameter)}</td>
                      <td className="text-slate-500">{when(alert.detectedAt as string)}</td>
                      <td><Badge value={String(alert.severity)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>

      <div className="dashboard-lower-grid">
        <section className="surface-card p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Mesures récentes</h2>
              <p className="mt-1 text-xs text-slate-500">Derniers relevés reçus</p>
            </div>
            <Link className="text-sm font-semibold text-brand hover:underline" to="/measurements">Tout voir</Link>
          </div>
          {meas.length === 0 ? (
            <Empty title="Aucune mesure enregistrée" />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {meas.slice(0, 4).map((measurement) => (
                <li key={String(measurement._id)} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium">
                      {(measurement.machineId as { name?: string })?.name ?? "Machine"}
                    </p>
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {String(measurement.source)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {(measurement.temperature as { value: number }).value} °C
                    {measurement.humidity
                      ? ` · ${(measurement.humidity as { value: number }).value}%`
                      : ""}
                    {" · "}{when(measurement.measuredAt as string)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface-card p-5 md:p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold">Activité récente</h2>
            <p className="mt-1 text-xs text-slate-500">Changements d’état du parc</p>
          </div>
          {events.length === 0 ? (
            <Empty title="Aucun changement récent" />
          ) : (
            <ul className="space-y-3">
              {events.slice(0, 4).map((event) => (
                <li key={String(event._id)} className="flex gap-3 text-xs">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" />
                  <span className="min-w-0 flex-1 text-slate-600 dark:text-slate-300">
                    <strong className="font-semibold">{(event.machineId as { name?: string })?.name}</strong>
                    <span className="block truncate text-slate-400">{String(event.fromStatus)} → {String(event.toStatus)}</span>
                  </span>
                  <span className="shrink-0 text-slate-400">{when(event.at as string)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface-card dashboard-equipment-status p-5 md:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">État des équipements</h2>
              <p className="mt-1 text-xs text-slate-500">{total} machines au total</p>
            </div>
            <Link className="dashboard-icon-button dashboard-icon-button-small" to="/machines" aria-label="Voir le parc machines">
              <ArrowUpRight size={17} />
            </Link>
          </div>
          <ul className="dashboard-equipment-status-list dashboard-equipment-status-vertical">
            {statuses.map((status) => {
              const share = total ? (status.value / total) * 100 : 0;
              return (
                <li key={status.label}>
                  <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <i className="legend-dot" style={{ backgroundColor: status.color }} />
                      {status.label}
                    </span>
                    <strong className="font-semibold">{status.value}</strong>
                  </div>
                  <div className="dashboard-status-track">
                    <span style={{ width: `${share}%`, backgroundColor: status.color }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
