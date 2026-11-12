import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Controller, useForm } from "react-hook-form";
import { AlertTriangle, ClipboardList, Wrench } from "lucide-react";
import { api, apiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Badge } from "../components/Badge";
import { Empty } from "../components/Empty";
import { Modal } from "../components/Modal";
import { when } from "../lib/format";
import { PageHeader } from "../components/PageHeader";
import { ListSelect } from "../components/ListSelect";
import { StatCard } from "../components/StatCard";

const STATUS_OPTIONS = [
  { value: "planned", label: "Planifiée" },
  { value: "todo", label: "À faire" },
  { value: "in_progress", label: "En cours" },
  { value: "on_hold", label: "En attente" },
  { value: "completed", label: "Terminée" },
  { value: "cancelled", label: "Annulée" },
];

const PRIORITY_LABELS: Record<string, string> = {
  low: "Basse",
  medium: "Moyenne",
  high: "Haute",
  urgent: "Urgente",
};
const ALERT_PARAMETER_IMAGES: Record<string, { src: string; alt: string; label: string }> = {
  temperature: {
    src: "/images/maintenance-technician.jpg",
    alt: "Technicien intervenant sur une machine industrielle",
    label: "Température",
  },
  current: {
    src: "/images/sensor-maintenance.jpg",
    alt: "Circuit et capteur électronique d’un équipement industriel",
    label: "Courant",
  },
  vibration: {
    src: "/images/factory-automation.jpg",
    alt: "Machine sur une ligne de production industrielle",
    label: "Vibration",
  },
};
const PAGE_SIZE = 9;

function priorityClass(priority: string) {
  if (priority === "urgent") return "intervention-priority intervention-priority-urgent";
  if (priority === "high") return "intervention-priority intervention-priority-high";
  if (priority === "low") return "intervention-priority intervention-priority-low";
  return "intervention-priority";
}

export function InterventionsPage() {
  const { hasRole } = useAuth();
  const [params] = useSearchParams();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [machines, setMachines] = useState<{ _id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ _id: string; firstName: string; lastName: string; role: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [technicianId, setTechnicianId] = useState("");
  const [page, setPage] = useState(() => Math.max(1, Number(params.get("page")) || 1));
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();
  const machineId = params.get("machineId") ?? "";

  const load = () => {
    const q = new URLSearchParams();
    q.set("page", String(page));
    q.set("limit", String(PAGE_SIZE));
    if (status) q.set("status", status);
    if (machineId) q.set("machineId", machineId);
    if (technicianId) q.set("technicianId", technicianId);
    setLoading(true);
    setError("");
    api.get(`/interventions?${q.toString()}`)
      .then((r) => {
        setRows(r.data.data);
        setTotal(r.data.meta.total);
      })
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, [status, machineId, technicianId, page]);

  useEffect(() => {
    api.get("/machines?limit=100").then((r) => setMachines(r.data.data));
    if (hasRole("admin", "maintenance_manager")) {
      api.get("/users?role=technician").then((r) => setUsers(r.data.data));
    }
  }, [hasRole]);

  const todoCount = rows.filter((item) => ["planned", "todo", "in_progress", "on_hold"].includes(String(item.status))).length;
  const urgentCount = rows.filter((item) => item.priority === "urgent").length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastItem = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="interventions-page space-y-4">
      <PageHeader
        section="PARC & MAINTENANCE"
        title="Interventions"
        description="Suivez les opérations de maintenance, leur priorité et leur planification."
        actions={hasRole("admin", "maintenance_manager") ? (
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            <Wrench size={16} />
            Nouvelle intervention
          </button>
        ) : undefined}
      />
      <div className="interventions-overview">
        <section className="intervention-summary" aria-label="Résumé des interventions affichées">
          <StatCard title="Interventions affichées" value={loading ? "—" : total} icon={ClipboardList} accent="violet" />
          <StatCard title="À traiter sur cette page" value={loading ? "—" : todoCount} icon={Wrench} accent="blue" />
          <StatCard title="Urgentes sur cette page" value={loading ? "—" : urgentCount} icon={AlertTriangle} accent="orange" />
        </section>

        <section className="interventions-toolbar" aria-label="Filtres des interventions">
          <div className="interventions-toolbar-title">
            <div>
              <h2>Suivi des interventions</h2>
              <p>Filtrez la liste pour retrouver rapidement une opération.</p>
            </div>
          </div>
          <div className="interventions-toolbar-actions">
            <span className="interventions-result-count">
              {loading ? "Chargement…" : `${firstItem}–${lastItem} sur ${total}`}
            </span>
            <div className="interventions-filters">
              <label className="interventions-filter">
                <span>Statut</span>
                <ListSelect
                  ariaLabel="Filtrer par statut"
                  value={status}
                  onChange={(value) => {
                    setStatus(value);
                    setPage(1);
                  }}
                  options={[
                    { value: "", label: "Tous les statuts" },
                    ...STATUS_OPTIONS,
                  ]}
                />
              </label>
              {hasRole("admin", "maintenance_manager") && (
                <label className="interventions-filter">
                  <span>Technicien</span>
                  <ListSelect
                    ariaLabel="Filtrer par technicien"
                    value={technicianId}
                    onChange={(value) => {
                      setTechnicianId(value);
                      setPage(1);
                    }}
                    options={[
                      { value: "", label: "Tous les techniciens" },
                      ...users.map((user) => ({ value: user._id, label: `${user.firstName} ${user.lastName}` })),
                    ]}
                  />
                </label>
              )}
            </div>
          </div>
        </section>
      </div>
      {error && <p className="interventions-error" role="alert">{error}</p>}
      {loading ? (
        <div className="interventions-empty">Chargement des interventions…</div>
      ) : rows.length === 0 ? (
        <Empty
          title={error ? "La liste n’a pas pu être chargée" : "Aucune intervention"}
          hint={error ? undefined : status || technicianId || machineId
            ? "Aucune intervention ne correspond aux filtres sélectionnés."
            : "Les interventions créées apparaîtront ici."}
        />
      ) : (
        <section className="intervention-list" aria-label="Liste des interventions">
          {rows.map((item) => {
            const machine = item.machineId as { name?: string; code?: string; location?: string } | undefined;
            const technician = item.assignedTechnicianId as { firstName?: string; lastName?: string } | undefined;
            const itemStatus = String(item.status ?? "");
            const priority = String(item.priority ?? "medium");
            const interventionType = String(item.type ?? "corrective");
            const alert = item.alertId as { parameter?: string } | undefined;
            const parameter = String(alert?.parameter ?? "");
            const illustration = ALERT_PARAMETER_IMAGES[parameter] ?? {
              src: "/images/maintenance-technician.jpg",
              alt: "Technicien réalisant une opération de maintenance industrielle",
              label: "Maintenance",
            };
            return (
              <article className={`machine-card intervention-card ${priority === "urgent" ? "intervention-card-urgent" : ""}`} key={String(item._id)}>
                <div className="machine-card-image intervention-card-image">
                  <img src={illustration.src} alt={illustration.alt} loading="lazy" />
                  <span className="machine-card-code">{String(item.reference)}</span>
                  <div className="intervention-image-badges">
                    <Badge value={itemStatus} />
                    <span className={`intervention-priority-chip ${priorityClass(priority)}`}>
                      {PRIORITY_LABELS[priority] ?? priority}
                    </span>
                  </div>
                  <span className="machine-card-illustrative">{illustration.label}</span>
                </div>
                <div className="machine-card-body intervention-card-body">
                  <div className="machine-card-heading">
                    <div className="min-w-0">
                      <h2 title={String(item.problemDescription || "Intervention de maintenance")}>
                        {String(item.problemDescription || "Intervention de maintenance")}
                      </h2>
                      <p>{machine?.name ?? "Machine non renseignée"}</p>
                    </div>
                  </div>
                  <dl className="machine-card-details intervention-card-details">
                    <div>
                      <dt>Type d’intervention</dt>
                      <dd>{interventionType === "corrective" ? "Corrective" : interventionType === "preventive" ? "Préventive" : "Inspection"}</dd>
                    </div>
                    <div>
                      <dt>Planification</dt>
                      <dd>{when(item.scheduledAt as string)}</dd>
                    </div>
                    <div>
                      <dt>Technicien</dt>
                      <dd>{technician?.firstName ? `${technician.firstName} ${technician.lastName ?? ""}`.trim() : "Non assigné"}</dd>
                    </div>
                    <div>
                      <dt>Localisation</dt>
                      <dd>{machine?.location || "—"}</dd>
                    </div>
                  </dl>
                  <Link className="machine-card-link" to={`/interventions/${item._id}`}>
                    Voir les détails <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      )}
      {!loading && total > PAGE_SIZE && (
        <nav className="page-pagination" aria-label="Pagination des interventions">
          <button
            className="btn btn-ghost"
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Précédent
          </button>
          <span className="py-2 text-sm">{page} / {pageCount}</span>
          <button
            className="btn btn-ghost"
            type="button"
            disabled={page >= pageCount}
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
          >
            Suivant
          </button>
        </nav>
      )}
      {open && (
        <Modal title="Nouvelle intervention" onClose={() => setOpen(false)}>
          <form
            className="space-y-2"
            onSubmit={handleSubmit(async (v) => {
              setError("");
              try {
                await api.post("/interventions", {
                  ...v,
                  scheduledAt: v.scheduledAt ? new Date(v.scheduledAt as string).toISOString() : undefined,
                });
                setOpen(false);
                reset();
                load();
              } catch (e) {
                setError(apiError(e));
              }
            })}
          >
            <label id="intervention-machine-label">Machine</label>
            <Controller
              control={control}
              name="machineId"
              rules={{ required: "Choisissez une machine." }}
              defaultValue=""
              render={({ field }) => (
                <ListSelect
                  ariaLabel="Choisir la machine de l’intervention"
                  ariaLabelledBy="intervention-machine-label"
                  value={String(field.value ?? "")}
                  onChange={field.onChange}
                  disabled={machines.length === 0}
                  options={machines.map((machine) => ({ value: machine._id, label: machine.name }))}
                />
              )}
            />
            {errors.machineId && <p className="text-sm text-red-600" role="alert">{String(errors.machineId.message)}</p>}
            <label id="intervention-type-label">Type</label>
            <Controller
              control={control}
              name="type"
              defaultValue="corrective"
              rules={{ required: true }}
              render={({ field }) => (
                <ListSelect
                  ariaLabel="Type d’intervention"
                  ariaLabelledBy="intervention-type-label"
                  value={String(field.value)}
                  onChange={field.onChange}
                  options={[
                    { value: "corrective", label: "Corrective" },
                    { value: "preventive", label: "Préventive" },
                    { value: "inspection", label: "Inspection" },
                  ]}
                />
              )}
            />
            <label htmlFor="intervention-description">Description</label>
            <textarea id="intervention-description" minLength={5} aria-invalid={Boolean(errors.problemDescription)} {...register("problemDescription", {
              required: "La description est obligatoire.",
              minLength: { value: 5, message: "La description doit contenir au moins 5 caractères." },
            })} />
            {errors.problemDescription && <p className="text-sm text-red-600" role="alert">{String(errors.problemDescription.message)}</p>}
            <label id="intervention-priority-label">Priorité</label>
            <Controller
              control={control}
              name="priority"
              defaultValue="medium"
              rules={{ required: true }}
              render={({ field }) => (
                <ListSelect
                  ariaLabel="Priorité de l’intervention"
                  ariaLabelledBy="intervention-priority-label"
                  value={String(field.value)}
                  onChange={field.onChange}
                  options={[
                    { value: "medium", label: "Moyenne" },
                    { value: "low", label: "Basse" },
                    { value: "high", label: "Haute" },
                    { value: "urgent", label: "Urgente" },
                  ]}
                />
              )}
            />
            <label id="intervention-technician-label">Technicien</label>
            <Controller
              control={control}
              name="assignedTechnicianId"
              defaultValue=""
              render={({ field }) => (
                <ListSelect
                  ariaLabel="Technicien affecté"
                  ariaLabelledBy="intervention-technician-label"
                  value={String(field.value ?? "")}
                  onChange={field.onChange}
                  options={[
                    { value: "", label: "Non assigné" },
                    ...users.map((user) => ({ value: user._id, label: `${user.firstName} ${user.lastName}` })),
                  ]}
                />
              )}
            />
            <label htmlFor="intervention-scheduled-at">Date planifiée</label>
            <input id="intervention-scheduled-at" type="datetime-local" {...register("scheduledAt")} />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button className="btn btn-primary">Enregistrer</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
