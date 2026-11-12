import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Clock3, Wrench } from "lucide-react";
import { api, apiError } from "../lib/api";
import { Badge } from "../components/Badge";
import { Empty } from "../components/Empty";
import { when } from "../lib/format";
import { useAuth } from "../lib/auth";
import { PageHeader } from "../components/PageHeader";
import { ListSelect } from "../components/ListSelect";

const PARAMETER_LABELS: Record<string, string> = {
  vibration: "Vibration",
  temperature: "Température",
  current: "Courant",
  connectivity: "Connectivité",
};

const PARAMETER_IMAGES: Record<string, string> = {
  vibration: "/images/factory-automation.jpg",
  temperature: "/images/sensor-maintenance.jpg",
  current: "/images/sensor-maintenance.jpg",
  connectivity: "/images/maintenance-technician.jpg",
};
const PAGE_SIZE = 9;

export function AlertsPage() {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const machineId = params.get("machineId") ?? "";

  const load = () => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (machineId) q.set("machineId", machineId);
    q.set("page", String(page));
    q.set("limit", String(PAGE_SIZE));
    setLoading(true);
    setError("");
    api.get(`/alerts?${q.toString()}`)
      .then((r) => {
        const nextTotal = Number(r.data.meta.total);
        const pageCount = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE));
        setRows(r.data.data);
        setTotal(nextTotal);
        if (page > pageCount) setPage(pageCount);
      })
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [status, machineId, page]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastItem = Math.min(page * PAGE_SIZE, total);

  const updateStatus = async (alertId: unknown, nextStatus: string) => {
    try {
      await api.patch(`/alerts/${alertId}/status`, { status: nextStatus });
      load();
    } catch (e) {
      setError(apiError(e));
    }
  };

  const createIntervention = async (alert: Record<string, unknown>) => {
    try {
      const created = await api.post("/interventions", {
        machineId: (alert.machineId as { _id: string })._id,
        alertId: alert._id,
        type: "corrective",
        problemDescription: String(alert.description ?? alert.parameter),
        priority: alert.severity === "critical" ? "urgent" : "high",
      });
      navigate(`/interventions/${created.data.data._id}`);
    } catch (e) {
      setError(apiError(e));
    }
  };

  return (
    <div className="alerts-page space-y-4">
      <PageHeader
        section="PARC & MAINTENANCE"
        title="Alertes"
        description="Une anomalie détectée n'est pas une panne certaine. Analysez les mesures et suivez leur résolution."
      />

      <section className="alerts-toolbar" aria-label="Filtres des alertes">
        <div>
          <h2>Centre des alertes</h2>
          <p>Consultez les anomalies détectées et leur niveau de gravité.</p>
        </div>
        <div className="alerts-toolbar-controls">
          <span className="alerts-count">
            {loading ? "Chargement…" : `${firstItem}–${lastItem} sur ${total} alerte${total > 1 ? "s" : ""}`}
          </span>
          <label className="alerts-status-filter">
            <span>Filtrer par statut</span>
            <ListSelect
              ariaLabel="Statut des alertes"
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              options={[
                { value: "", label: "Tous les statuts" },
                { value: "new", label: "Nouvelle" },
                { value: "acknowledged", label: "Reconnue" },
                { value: "in_progress", label: "En cours" },
                { value: "resolved", label: "Résolue" },
              ]}
            />
          </label>
        </div>
      </section>

      {error && <p className="alerts-error" role="alert">{error}</p>}
      {loading ? (
        <div className="alerts-empty">Chargement des alertes…</div>
      ) : rows.length === 0 ? (
        <Empty
          title={error ? "Les alertes n’ont pas pu être chargées" : "Aucune alerte"}
          hint={error ? undefined : status
            ? "Aucune alerte ne correspond au statut sélectionné."
            : "Les anomalies détectées sur vos machines apparaîtront ici."}
        />
      ) : (
        <section className="alerts-list" aria-label="Liste des alertes">
          {rows.map((alert) => {
            const machine = alert.machineId as { _id?: string; name?: string; code?: string } | undefined;
            const severity = String(alert.severity ?? "warning");
            const alertStatus = String(alert.status ?? "new");
            const parameter = String(alert.parameter ?? "");
            const parameterLabel = PARAMETER_LABELS[parameter] ?? parameter;
            const observedValue = alert.observedValue == null
              ? (severity === "critical" ? "Critique" : "Vigilance")
              : `${String(alert.observedValue)} ${String(alert.unit ?? "")}`.trim();

            return (
              <article
                key={String(alert._id)}
                className={`machine-card alert-card alert-card-${severity}`}
              >
                <div className="machine-card-image alert-card-image">
                  <img
                    src={PARAMETER_IMAGES[parameter] ?? "/images/factory-automation.jpg"}
                    alt={`${parameterLabel} — environnement de maintenance industrielle`}
                    loading="lazy"
                  />
                  <span className="machine-card-code">
                    {machine?.code ?? "ALERTE"}
                  </span>
                  <div className="alert-image-badges">
                    <Badge value={severity} />
                    <Badge value={alertStatus} />
                  </div>
                  <span className="machine-card-illustrative">Illustration</span>
                </div>
                <div className="machine-card-body alert-card-body">
                  <div className="machine-card-heading alert-card-heading">
                    <div className="min-w-0">
                      <h2 title={machine?.name ?? "Machine inconnue"}>{machine?.name ?? "Machine inconnue"}</h2>
                      <p>{parameterLabel}</p>
                    </div>
                    <Badge value={severity} />
                  </div>
                  <dl className="machine-card-details alert-card-details">
                    <div>
                      <dt>Valeur détectée</dt>
                      <dd>{observedValue}</dd>
                    </div>
                    <div>
                      <dt>Seuil</dt>
                      <dd>{alert.threshold == null ? "—" : `${String(alert.threshold)} ${String(alert.unit ?? "")}`.trim()}</dd>
                    </div>
                    <div>
                      <dt>Détectée le</dt>
                      <dd>{when(alert.detectedAt as string)}</dd>
                    </div>
                    <div>
                      <dt>Observation</dt>
                      <dd className="alert-card-observation">
                        {String(alert.description ?? "Une anomalie a été détectée.")}
                      </dd>
                    </div>
                  </dl>
                  <div className="alert-card-actions alert-card-footer">
                  {alertStatus === "new" && (
                    <button className="alert-action-link" onClick={() => updateStatus(alert._id, "acknowledged")}>
                      Reconnaître <Check size={15} />
                    </button>
                  )}
                  {alertStatus !== "resolved" && (
                    <button className="alert-action-link" onClick={() => updateStatus(alert._id, "resolved")}>
                      Résoudre <ArrowRight size={15} />
                    </button>
                  )}
                  {hasRole("admin", "maintenance_manager") && !alert.interventionId && (
                    <button className="alert-action-link" onClick={() => createIntervention(alert)}>
                      Intervention <Wrench size={15} />
                    </button>
                  )}
                  {alertStatus === "resolved" && (
                    <span className="alert-resolved-label">
                      <Clock3 size={15} />
                      Alerte clôturée
                    </span>
                  )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
      {!loading && total > PAGE_SIZE && (
        <nav className="page-pagination alerts-pagination" aria-label="Pagination des alertes">
          <button
            className="btn btn-ghost"
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            <ArrowLeft size={15} />
            Précédent
          </button>
          <span aria-live="polite">{page} / {pageCount}</span>
          <button
            className="btn btn-ghost"
            type="button"
            disabled={page >= pageCount}
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
          >
            Suivant
            <ArrowRight size={15} />
          </button>
        </nav>
      )}
    </div>
  );
}
