import { useEffect, useState } from "react";
import { Activity, Clock3, Database, Gauge, Save, Settings2, ShieldAlert, ShieldCheck, Thermometer, Zap } from "lucide-react";
import { api, apiError } from "../lib/api";
import { Machine } from "./MachinesPage";
import { PageHeader } from "../components/PageHeader";
import { ListSelect } from "../components/ListSelect";

export function SettingsPage() {
  const [sys, setSys] = useState({ offlineTimeoutMs: 120000, measurementRetentionDays: 90 });
  const [machines, setMachines] = useState<(Machine & {
    thresholds?: {
      vibration?: { unit?: string; warningMax?: number; criticalMax?: number };
      temperature?: { warningMax?: number; criticalMax?: number };
      current?: { warningMin?: number; warningMax?: number; criticalMin?: number; criticalMax?: number };
    };
    confirmationCount?: number;
  })[]>([]);
  const [selected, setSelected] = useState("");
  const [th, setTh] = useState({
    warningMaxV: 0.5,
    criticalMaxV: 1,
    warningMaxT: 70,
    criticalMaxT: 90,
    warningMaxC: 8,
    criticalMaxC: 12,
    warningMinC: 1.5,
    criticalMinC: 0.5,
    confirmationCount: 3,
  });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.get("/settings").then((r) => setSys(r.data.data)).catch((err) => setMsg(apiError(err)));
    api.get("/machines?limit=100").then((r) => setMachines(r.data.data)).catch((err) => setMsg(apiError(err)));
  }, []);

  return (
    <div className="settings-page space-y-4">
      <PageHeader
        section="GESTION"
        title="Seuils & système"
        description="Gérez la surveillance et les seuils des équipements."
      />
      {msg && <p className="settings-message" role="status">{msg}</p>}
      <div className="settings-grid">
        <form
          className="settings-panel"
          onSubmit={async (e) => {
            e.preventDefault();
            setMsg("");
            try {
              await api.patch("/settings", sys);
              setMsg("Paramètres système enregistrés.");
            } catch (err) {
              setMsg(apiError(err));
            }
          }}
        >
          <div className="settings-panel-header">
            <span className="settings-panel-icon settings-panel-icon-blue"><Settings2 size={19} /></span>
            <div>
              <h2>Paramètres système</h2>
              <p className="text-sm text-slate-500">Détection des pannes et conservation des données.</p>
            </div>
          </div>
          <div className="settings-system-fields">
            <div className="settings-field">
              <label htmlFor="offline-timeout" className="flex items-center gap-2"><Clock3 size={15} />Délai hors ligne</label>
              <input id="offline-timeout" type="number" min="1000" value={sys.offlineTimeoutMs} onChange={(e) => setSys({ ...sys, offlineTimeoutMs: Number(e.target.value) })} />
              <p>Millisecondes sans communication avant détection.</p>
            </div>
            <div className="settings-field">
              <label htmlFor="retention-days" className="flex items-center gap-2"><Database size={15} />Conservation des mesures</label>
              <input id="retention-days" type="number" min="1" value={sys.measurementRetentionDays} onChange={(e) => setSys({ ...sys, measurementRetentionDays: Number(e.target.value) })} />
              <p>Nombre de jours d’historique à conserver.</p>
            </div>
          </div>
          <div className="settings-panel-footer">
            <button className="btn btn-primary"><Save size={16} />Enregistrer</button>
          </div>
        </form>

        <form
          className="settings-panel settings-threshold-panel"
          onSubmit={async (e) => {
            e.preventDefault();
            setMsg("");
            if (!selected) {
              setMsg("Choisissez une machine.");
              return;
            }
            if (
              th.warningMaxV <= 0 ||
              th.warningMaxV >= th.criticalMaxV ||
              th.criticalMaxV > 1 ||
              th.warningMaxT < -20 ||
              th.warningMaxT >= th.criticalMaxT ||
              th.criticalMaxT > 150 ||
              th.warningMaxC < 0 ||
              th.warningMaxC >= th.criticalMaxC ||
              th.criticalMaxC > 100 ||
              th.criticalMinC < 0 ||
              th.criticalMinC >= th.warningMinC ||
              th.warningMinC >= th.warningMaxC ||
              !Number.isInteger(th.confirmationCount) ||
              th.confirmationCount < 1 ||
              th.confirmationCount > 20
            ) {
              setMsg("Seuils invalides : vérifiez les limites de vibration, température et courant. Pour le courant, le seuil critique bas doit être sous le seuil de vigilance bas, puis viennent les seuils hauts. La confirmation doit être entre 1 et 20.");
              return;
            }
            try {
              const response = await api.patch(`/machines/${selected}`, {
                confirmationCount: th.confirmationCount,
                thresholds: {
                  vibration: { unit: "detection", validMin: 0, validMax: 1, warningMax: th.warningMaxV, criticalMax: th.criticalMaxV },
                  temperature: { unit: "C", validMin: -20, validMax: 150, warningMax: th.warningMaxT, criticalMax: th.criticalMaxT },
                  current: {
                    unit: "A",
                    validMin: 0,
                    validMax: 100,
                    warningMin: th.warningMinC,
                    warningMax: th.warningMaxC,
                    criticalMin: th.criticalMinC,
                    criticalMax: th.criticalMaxC,
                  },
                },
              });
              setMachines((current) =>
                current.map((machine) =>
                  machine._id === selected ? { ...machine, ...response.data.data } : machine,
                ),
              );
              setMsg("Seuils et confirmation enregistrés pour cette machine.");
            } catch (err) {
              setMsg(apiError(err));
            }
          }}
        >
          <div className="settings-panel-header">
            <span className="settings-panel-icon settings-panel-icon-amber"><ShieldAlert size={19} /></span>
            <div>
              <h2>Seuils par machine</h2>
              <p className="text-sm text-slate-500">Définissez quand déclencher les alertes.</p>
            </div>
          </div>
          <div className="settings-machine-picker">
            <label id="threshold-machine-label">Machine</label>
            <ListSelect
              ariaLabel="Machine à configurer"
              ariaLabelledBy="threshold-machine-label"
              value={selected}
              onChange={(id) => {
                const machine = machines.find((item) => item._id === id);
                setSelected(id);
                if (!machine) return;
                const vibrationIsDetection = machine.thresholds?.vibration?.unit === "detection";
                setTh({
                  warningMaxV: vibrationIsDetection ? machine.thresholds?.vibration?.warningMax ?? 0.5 : 0.5,
                  criticalMaxV: vibrationIsDetection ? machine.thresholds?.vibration?.criticalMax ?? 1 : 1,
                  warningMaxT: machine.thresholds?.temperature?.warningMax ?? 70,
                  criticalMaxT: machine.thresholds?.temperature?.criticalMax ?? 90,
                  warningMaxC: machine.thresholds?.current?.warningMax ?? 8,
                  criticalMaxC: machine.thresholds?.current?.criticalMax ?? 12,
                  warningMinC: machine.thresholds?.current?.warningMin ?? 1.5,
                  criticalMinC: machine.thresholds?.current?.criticalMin ?? 0.5,
                  confirmationCount: machine.confirmationCount ?? 3,
                });
              }}
              options={[
                { value: "", label: "Choisir une machine" },
                ...machines.map((machine) => ({ value: machine._id, label: machine.name })),
              ]}
            />
          </div>

          <div className="settings-threshold-metrics">
            {[
              { key: "vibration", title: "Vibration SW-420 · détection (0 ou 1)", icon: Activity, warning: "warningMaxV" as const, critical: "criticalMaxV" as const, step: "0.01", min: 0, max: 1, unit: "" },
              { key: "temperature", title: "Température", icon: Thermometer, warning: "warningMaxT" as const, critical: "criticalMaxT" as const, step: "1", min: -20, max: 150, unit: "°C" },
              { key: "current", title: "Courant", icon: Zap, warning: "warningMaxC" as const, critical: "criticalMaxC" as const, step: "0.1", min: 0, max: 100, unit: "A" },
            ].map((metric) => (
              <fieldset key={metric.title} className={`settings-threshold-group settings-threshold-group-${metric.key}`}>
                <legend><metric.icon size={15} />{metric.title}</legend>
                <div className="settings-threshold-inputs">
                  <div className="settings-field">
                    <label htmlFor={`${metric.warning}-threshold`}>Vigilance {metric.unit && `(${metric.unit})`}</label>
                    <input id={`${metric.warning}-threshold`} type="number" min={metric.min} max={metric.max} step={metric.step} value={th[metric.warning]} onChange={(e) => setTh({ ...th, [metric.warning]: Number(e.target.value) })} />
                  </div>
                  <div className="settings-field">
                    <label htmlFor={`${metric.critical}-threshold`}>Critique {metric.unit && `(${metric.unit})`}</label>
                    <input id={`${metric.critical}-threshold`} type="number" min={metric.min} max={metric.max} step={metric.step} value={th[metric.critical]} onChange={(e) => setTh({ ...th, [metric.critical]: Number(e.target.value) })} />
                  </div>
                </div>
                {metric.warning === "warningMaxV" && (
                  <p className="settings-inline-note">
                    Le capteur SW-420 est binaire : il détecte une vibration, sans mesurer son intensité en g.
                  </p>
                )}
                {metric.key === "current" && (
                  <div className="settings-threshold-inputs">
                    <div className="settings-field">
                      <label htmlFor="warning-min-current">Vigilance sous (A)</label>
                      <input
                        id="warning-min-current"
                        type="number"
                        min="0"
                        max={th.warningMaxC}
                        step="0.1"
                        value={th.warningMinC}
                        onChange={(e) => setTh({ ...th, warningMinC: Number(e.target.value) })}
                      />
                    </div>
                    <div className="settings-field">
                      <label htmlFor="critical-min-current">Critique sous (A)</label>
                      <input
                        id="critical-min-current"
                        type="number"
                        min="0"
                        max={th.warningMinC}
                        step="0.1"
                        value={th.criticalMinC}
                        onChange={(e) => setTh({ ...th, criticalMinC: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                )}
              </fieldset>
            ))}
          </div>
          <div className="settings-confirmation-field">
            <label htmlFor="confirmation-count" className="flex items-center gap-2"><Activity size={15} />Échantillons consécutifs avant alerte</label>
            <input id="confirmation-count" type="number" min="1" max="20" value={th.confirmationCount} onChange={(e) => setTh({ ...th, confirmationCount: Number(e.target.value) })} />
            <p>De 1 à 20 mesures consécutives. À 4 secondes par mesure, 1 = environ 4 s, 3 = 12 s et 20 = 80 s.</p>
          </div>
          <div className="settings-notification-note">
            <ShieldCheck size={18} aria-hidden="true" />
            <p>
              Après enregistrement, un dépassement confirmé crée une alerte et une notification dans l’application pour l’administrateur, le responsable maintenance et le technicien affecté. Si la notification est lue alors que le dépassement continue, un rappel est envoyé à la prochaine mesure. Aucune répétition n’est envoyée tant qu’un rappel reste non lu. Les notifications push lorsque l’application est fermée ne sont pas configurées.
            </p>
          </div>
          <div className="settings-panel-footer">
            <button className="btn btn-primary"><Save size={16} />Enregistrer les seuils</button>
          </div>
        </form>
      </div>
    </div>
  );
}
