import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, apiError } from "../lib/api";
import { Badge } from "../components/Badge";
import { Empty } from "../components/Empty";
import { Modal } from "../components/Modal";
import { useAuth } from "../lib/auth";
import { usePeriod } from "../lib/period";
import { connectSocket } from "../lib/socket";
import { when } from "../lib/format";
import { PageHeader } from "../components/PageHeader";
import { ListSelect } from "../components/ListSelect";

type MeasurementDto = {
  _id: string;
  machineId: string | { _id: string };
  measuredAt: string;
  vibration: { value: number };
  temperature: { value: number };
  humidity?: { value: number };
  current: { value: number };
};

type MeasurementPoint = {
  _id: string;
  measuredAt: string;
  vibration: number;
  temperature: number;
  humidity: number | null;
  current: number;
};

type MetricName = "vibration" | "temperature" | "current";
type MetricThreshold = { unit?: string; warningMax?: number; criticalMax?: number };

function toMeasurementPoint(row: MeasurementDto): MeasurementPoint {
  return {
    _id: row._id,
    measuredAt: row.measuredAt,
    vibration: row.vibration.value,
    temperature: row.temperature.value,
    humidity: row.humidity?.value ?? null,
    current: row.current.value,
  };
}

export function MachineDetailPage() {
  const { id } = useParams();
  const { hasRole } = useAuth();
  const { hours } = usePeriod();
  const [machine, setMachine] = useState<Record<string, unknown> | null>(null);
  const [series, setSeries] = useState<MeasurementPoint[]>([]);
  const [techs, setTechs] = useState<{ _id: string; firstName: string; lastName: string }[]>([]);
  const [msg, setMsg] = useState("");
  const [machineError, setMachineError] = useState("");
  const [measurementError, setMeasurementError] = useState("");
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "",
    brand: "",
    model: "",
    location: "",
    assignedTechnicianId: "",
  });

  const load = (updateForm = true) => {
    if (!id) return;
    api.get(`/machines/${id}`).then((r) => {
      const m = r.data.data;
      setMachine(m);
      setMachineError("");
      if (updateForm) {
        setForm({
          name: m.name ?? "",
          description: m.description ?? "",
          type: m.type ?? "",
          brand: m.brand ?? "",
          model: m.model ?? "",
          location: m.location ?? "",
          assignedTechnicianId: m.assignedTechnicianId?._id ?? "",
        });
      }
    }).catch((e) => setMachineError(apiError(e)));

    const to = new Date();
    const from = new Date(to.getTime() - hours * 3600_000);
    const query = `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
    api.get(`/machines/${id}/measurements?limit=80&${query}`).then((r) => {
      setSeries(
        [...(r.data.data as MeasurementDto[])].reverse().map(toMeasurementPoint),
      );
      setMeasurementError("");
    }).catch((e) => setMeasurementError(apiError(e)));
  };

  useEffect(() => {
    load();
    if (hasRole("admin", "maintenance_manager")) {
      api.get("/users?role=technician&limit=100").then((r) => setTechs(r.data.data));
    }
    const socket = connectSocket();
    const onMeasurement = (measurement: MeasurementDto) => {
      const machineId =
        typeof measurement.machineId === "string"
          ? measurement.machineId
          : measurement.machineId?._id;
      if (machineId !== id) return;

      const point = toMeasurementPoint(measurement);
      if (new Date(point.measuredAt).getTime() < Date.now() - hours * 3600_000) return;

      setSeries((current) => {
        if (current.some((row) => row._id === point._id)) return current;
        return [...current, point]
          .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime())
          .slice(-80);
      });
    };
    const onMachineUpdated = (event: { machineId: string }) => {
      if (event.machineId !== id) return;
      load(false);
    };
    const onConnect = () => load(false);
    socket?.on("measurement:new", onMeasurement);
    socket?.on("machine:updated", onMachineUpdated);
    socket?.on("connect", onConnect);
    const refreshTimer = window.setInterval(() => load(false), 5000);
    return () => {
      socket?.off("measurement:new", onMeasurement);
      socket?.off("machine:updated", onMachineUpdated);
      socket?.off("connect", onConnect);
      window.clearInterval(refreshTimer);
    };
  }, [id, hours]);

  if (!machine) {
    return (
      <div className="space-y-4">
        {machineError ? (
          <>
            <p className="text-red-600" role="alert">{machineError}</p>
            <Link className="underline" to="/machines">Retour au parc machines</Link>
          </>
        ) : <p role="status">Chargement…</p>}
      </div>
    );
  }

  const tech = machine.assignedTechnicianId as { firstName?: string; lastName?: string } | undefined;
  const thresholds = machine.thresholds as Partial<Record<MetricName, MetricThreshold>> | undefined;
  const chartMetrics: {
    key: keyof MeasurementPoint;
    metric?: MetricName;
    title: string;
    unit: string;
    color: string;
  }[] = [
    { key: "vibration", metric: "vibration", title: "Vibration détectée (0/1)", unit: "", color: "#f59e0b" },
    { key: "temperature", metric: "temperature", title: "Température", unit: "°C", color: "#2563eb" },
    { key: "current", metric: "current", title: "Courant", unit: "A", color: "#0d9488" },
  ];
  if (series.some((row) => row.humidity !== null)) {
    chartMetrics.push({ key: "humidity", title: "Humidité", unit: "%", color: "#64748b" });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        section="PARC & MAINTENANCE"
        title={String(machine.name)}
        description={`${String(machine.code)} · ${String(machine.location)} · ${String(machine.type)}`}
        actions={<Badge value={String(machine.healthStatus)} />}
      />
      {machineError && <p className="text-sm text-red-600" role="alert">{machineError}</p>}
      <section className="surface-card space-y-2 p-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {String(machine.brand || "Marque inconnue")} {String(machine.model || "")} · Technicien :{" "}
          {tech?.firstName ? `${tech.firstName} ${tech.lastName}` : "non assigné"}
        </p>
        {Boolean(machine.description) && (
          <p className="text-sm">{String(machine.description)}</p>
        )}
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Dernière communication : {when(machine.lastCommunicationAt as string)} · Risque heuristique :{" "}
          {String(machine.heuristicRisk)} / 100{" "}
          <span className="text-slate-500">(indicateur de seuils, pas un modèle ML)</span>
        </p>
      </section>
      <div className="surface-card p-4">
        <div className="mb-3">
          <h2 className="font-semibold">Mesures en temps réel et seuils</h2>
          <p className="text-xs text-slate-500">
            Chaque capteur a sa propre échelle. Les lignes orange indiquent la vigilance et les rouges le seuil critique.
            Les seuils se mettent à jour dès qu’ils sont enregistrés dans Paramètres.
          </p>
        </div>
        {measurementError && <p className="mb-3 text-sm text-red-600" role="alert">{measurementError}</p>}
        {series.length === 0 ? (
          <Empty
            title={measurementError ? "Les mesures n’ont pas pu être chargées" : "Pas encore de mesures"}
            hint={measurementError ? undefined : "Élargissez la période ou démarrez la simulation."}
          />
        ) : (
          <div className="space-y-5">
            {chartMetrics.map((metric) => {
              const threshold = metric.metric ? thresholds?.[metric.metric] : undefined;
              const values = series
                .map((row) => row[metric.key])
                .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
              if (threshold?.warningMax !== undefined) values.push(threshold.warningMax);
              if (threshold?.criticalMax !== undefined) values.push(threshold.criticalMax);
              const min = Math.min(...values);
              const max = Math.max(...values);
              const padding = Math.max((max - min) * 0.12, Math.abs(max) * 0.03, 0.1);

              return (
                <section key={metric.key} aria-label={`${metric.title} et ses seuils`}>
                  <h3 className="mb-1 text-sm font-medium">
                    {metric.title}{metric.unit ? ` (${metric.unit})` : ""}
                  </h3>
                  <ResponsiveContainer width="100%" height={210}>
                    <LineChart data={series}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="measuredAt" tickFormatter={(value) => new Date(value).toLocaleTimeString("fr-FR")} />
                      <YAxis domain={[min - padding, max + padding]} />
                      <Tooltip
                        labelFormatter={(value) => new Date(String(value)).toLocaleString("fr-FR")}
                        formatter={(value) => [`${value}${metric.unit ? ` ${metric.unit}` : ""}`, metric.title]}
                      />
                      <Legend />
                      {threshold?.warningMax !== undefined && (
                        <ReferenceLine
                          y={threshold.warningMax}
                          stroke="#f59e0b"
                          strokeDasharray="5 5"
                          label={{ value: `Vigilance ${threshold.warningMax}`, fill: "#b45309", position: "insideTopRight", fontSize: 11 }}
                        />
                      )}
                      {threshold?.criticalMax !== undefined && (
                        <ReferenceLine
                          y={threshold.criticalMax}
                          stroke="#dc2626"
                          strokeDasharray="5 5"
                          label={{ value: `Critique ${threshold.criticalMax}`, fill: "#b91c1c", position: "insideBottomRight", fontSize: 11 }}
                        />
                      )}
                      <Line
                        dataKey={metric.key}
                        name={metric.title}
                        stroke={metric.color}
                        dot={false}
                        connectNulls
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </section>
              );
            })}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {hasRole("admin", "maintenance_manager") && (
          <button className="btn btn-primary" onClick={() => setEdit(true)}>
            Modifier
          </button>
        )}
        {hasRole("admin") && machine.operationalStatus !== "inactive" && (
          <button
            className="btn btn-ghost"
            onClick={async () => {
              if (!confirm("Désactiver cette machine sans supprimer l'historique ?")) return;
              try {
                await api.post(`/machines/${id}/deactivate`);
                load();
              } catch (e) {
                setMsg(apiError(e));
              }
            }}
          >
            Désactiver
          </button>
        )}
      </div>
      {msg && <p className="text-red-600">{msg}</p>}
      <div className="flex gap-3 text-sm">
        <Link className="underline" to={`/alerts?machineId=${id}`}>
          Alertes
        </Link>
        <Link className="underline" to={`/interventions?machineId=${id}`}>
          Interventions
        </Link>
      </div>
      {edit && (
        <Modal title="Modifier la machine" onClose={() => setEdit(false)}>
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setMsg("");
              try {
                await api.patch(`/machines/${id}`, {
                  ...form,
                  assignedTechnicianId: form.assignedTechnicianId || null,
                });
                setEdit(false);
                load();
              } catch (err) {
                setMsg(apiError(err));
              }
            }}
          >
            <label>Nom</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <label>Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <label>Type</label>
            <input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
            <label>Marque</label>
            <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            <label>Modèle</label>
            <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            <label>Localisation</label>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <label id="machine-technician-label">Technicien responsable</label>
            <ListSelect
              ariaLabel="Technicien responsable"
              ariaLabelledBy="machine-technician-label"
              value={form.assignedTechnicianId}
              onChange={(assignedTechnicianId) => setForm({ ...form, assignedTechnicianId })}
              options={[
                { value: "", label: "Non assigné" },
                ...techs.map((technician) => ({
                  value: technician._id,
                  label: `${technician.firstName} ${technician.lastName}`,
                })),
              ]}
            />
            <button className="btn btn-primary mt-2">Enregistrer</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
