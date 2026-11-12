import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Play, RotateCcw, Settings2, Square, Waves } from "lucide-react";
import { api, apiError } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { ListSelect } from "../components/ListSelect";

const SCENARIOS = [
  { value: "normal", label: "Fonctionnement normal", detail: "Mesures dans les limites", indicator: "bg-emerald-500" },
  { value: "warning", label: "Vigilance", detail: "Dépassement modéré des seuils", indicator: "bg-amber-500" },
  { value: "critical", label: "État critique", detail: "Dépassement important des seuils", indicator: "bg-red-500" },
  { value: "offline", label: "Machine hors ligne", detail: "Simuler une perte de communication", indicator: "bg-slate-400" },
  { value: "sensor_error", label: "Erreur capteur", detail: "Simuler une anomalie de capteur", indicator: "bg-sky-500" },
] as const;

export function SimulationPage() {
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [machines, setMachines] = useState<{ _id: string; name: string }[]>([]);
  const [machineId, setMachineId] = useState("");
  const [intervalMs, setIntervalMs] = useState(4000);
  const [msg, setMsg] = useState("");

  const load = () => api.get("/simulation").then((r) => setStatus(r.data.data));
  useEffect(() => {
    load().catch((e) => setMsg(apiError(e)));
    api.get("/machines?limit=100").then((r) => {
      setMachines(r.data.data);
      if (r.data.data[0]) setMachineId(r.data.data[0]._id);
    }).catch((e) => setMsg(apiError(e)));
  }, []);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg("");
    try {
      await fn();
      await load();
      setMsg(ok);
    } catch (e) {
      setMsg(apiError(e));
    }
  };

  const isRunning = Boolean(status?.running);

  return (
    <div className="simulation-page">
      <PageHeader
        section="GESTION"
        title="Simulation"
        description="Testez les alertes et les états des machines sans capteurs physiques."
      />

      <div className="simulation-notice flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <AlertTriangle size={19} className="mt-0.5 shrink-0" />
        <p className="text-sm leading-relaxed">
          Les données générées sont synthétiques et identifiées comme simulation. Elles ne remplacent pas les mesures de capteurs physiques.
        </p>
      </div>

      {msg && <p className="simulation-message rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-anthracite dark:text-slate-200" role="status">{msg}</p>}

      <div className="simulation-grid">
        <section className="simulation-panel surface-card">
          <div className="simulation-panel-header flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300"><Waves size={19} /></span>
            <div>
              <h2 className="font-semibold">État du simulateur</h2>
              <p className="text-sm text-slate-500">Contrôlez la génération automatique des mesures.</p>
            </div>
          </div>

          <div className="simulation-control-row">
            <div className={`simulation-status flex items-center justify-between rounded-xl border p-4 ${isRunning ? "simulation-status-running border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20" : "simulation-status-stopped border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50"}`}>
              <div className="flex min-w-0 items-center gap-3">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${isRunning ? "bg-emerald-500" : "bg-slate-400"}`} />
                <div className="min-w-0">
                  <p className="font-medium">{isRunning ? "Simulation en cours" : "Simulation arrêtée"}</p>
                  <p className="text-sm text-slate-500">Intervalle actuel : {status ? `${String(status.intervalMs)} ms` : "—"}</p>
                </div>
              </div>
              {isRunning ? <CheckCircle2 className="shrink-0 text-emerald-600" size={20} /> : <Clock3 className="shrink-0 text-slate-400" size={20} />}
            </div>

            <div className="simulation-frequency">
              <label htmlFor="simulation-interval">Fréquence des mesures</label>
              <div className="simulation-frequency-controls">
                <input id="simulation-interval" type="number" min="500" step="500" value={intervalMs} onChange={(e) => setIntervalMs(Number(e.target.value))} />
                <button className="btn btn-ghost shrink-0" onClick={() => act(() => api.post("/simulation/interval", { intervalMs }), "Fréquence mise à jour")}>
                  <Settings2 size={16} />Appliquer
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">Intervalle en millisecondes entre deux mesures simulées.</p>
            </div>

            <div className="simulation-actions">
              <button disabled={isRunning} className="btn btn-primary" onClick={() => act(() => api.post("/simulation/start", { intervalMs }), "Simulateur démarré")}>
                <Play size={16} />Démarrer
              </button>
              <button disabled={!isRunning} className="btn btn-ghost" onClick={() => act(() => api.post("/simulation/stop"), "Simulateur arrêté")}>
                <Square size={15} />Arrêter
              </button>
            </div>
          </div>
        </section>

        <section className="simulation-panel simulation-scenario-panel surface-card">
          <div className="simulation-panel-header flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300"><RotateCcw size={19} /></span>
            <div>
              <h2 className="font-semibold">Scénario de machine</h2>
              <p className="text-sm text-slate-500">Appliquez un état simulé à une machine.</p>
            </div>
          </div>

          <div className="simulation-scenario-controls">
            <div className="simulation-machine-picker">
              <label id="scenario-machine-label">Machine concernée</label>
              <ListSelect
                value={machineId}
                onChange={setMachineId}
                ariaLabel="Machine concernée"
                disabled={machines.length === 0}
                options={machines.map((machine) => ({ value: machine._id, label: machine.name }))}
              />
            </div>

            <div className="simulation-scenario-list">
              <p className="text-sm font-medium">Choisir un scénario</p>
              <div className="simulation-scenario-options">
                {SCENARIOS.map((scenario) => (
                  <button
                    key={scenario.value}
                    disabled={!machineId}
                    className={`simulation-scenario simulation-scenario-${scenario.value} flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-anthracite`}
                    onClick={() => act(() => api.post("/simulation/scenario", { machineId, scenario: scenario.value }), `Scénario « ${scenario.label} » appliqué`)}
                  >
                    <span className="flex items-center gap-3">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${scenario.indicator}`} />
                      <span>
                        <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{scenario.label}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">{scenario.detail}</span>
                      </span>
                    </span>
                    <Play size={16} className="shrink-0 text-brand" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
