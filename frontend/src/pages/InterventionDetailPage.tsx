import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Ban,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Cpu,
  FileText,
  History,
  Pause,
  Play,
  Save,
  Wrench,
} from "lucide-react";
import { api, apiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Badge } from "../components/Badge";
import { when } from "../lib/format";
import { PageHeader } from "../components/PageHeader";

type InterventionPart = { name: string; quantity: number };
type InterventionHistory = {
  action: string;
  fromStatus?: string;
  toStatus?: string;
  at?: string;
  note?: string;
};

function parseParts(value: string): InterventionPart[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, quantity] = part.split(":");
      return { name: name.trim(), quantity: Number(quantity ?? 1) || 1 };
    });
}

export function InterventionDetailPage() {
  const { id } = useParams();
  const { hasRole } = useAuth();
  const [doc, setDoc] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({ diagnosis: "", actions: "", observations: "", parts: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!id) return;
    api.get(`/interventions/${id}`).then((r) => {
      setDoc(r.data.data);
      setForm({
        diagnosis: r.data.data.diagnosis ?? "",
        actions: r.data.data.actions ?? "",
        observations: r.data.data.observations ?? "",
        parts: (r.data.data.parts ?? [])
          .map((part: InterventionPart) => `${part.name}:${part.quantity}`)
          .join(", "),
      });
    }).catch((err) => setError(apiError(err)));
  };

  useEffect(() => {
    load();
  }, [id]);

  const patch = async (body: Record<string, unknown>) => {
    setError("");
    setSaving(true);
    try {
      await api.patch(`/interventions/${id}`, body);
      load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (!doc) {
    return (
      <div className="intervention-detail-page intervention-detail-loading">
        <Link className="intervention-back-link" to="/interventions">
          <ArrowLeft size={16} />Retour aux interventions
        </Link>
        {error ? (
          <p className="intervention-detail-error" role="alert">
            {error}
          </p>
        ) : <p className="intervention-detail-loading-message">Chargement de l’intervention…</p>}
      </div>
    );
  }

  const machine = doc.machineId as { _id?: string; name?: string; code?: string; location?: string } | undefined;
  const technician = doc.assignedTechnicianId as { firstName?: string; lastName?: string; email?: string } | undefined;
  const alert = doc.alertId as { _id?: string } | string | undefined;
  const alertId = typeof alert === "object" ? alert?._id : alert;
  const history = Array.isArray(doc.history) ? doc.history as InterventionHistory[] : [];
  const status = String(doc.status);
  const canCancel = hasRole("admin", "maintenance_manager") && !["completed", "cancelled"].includes(status);
  const typeLabels: Record<string, string> = {
    corrective: "Corrective",
    preventive: "Préventive",
    inspection: "Inspection",
  };
  const priorityLabels: Record<string, string> = {
    low: "Basse",
    medium: "Moyenne",
    high: "Haute",
    urgent: "Urgente",
  };
  const reportBody = {
    diagnosis: form.diagnosis,
    actions: form.actions,
    observations: form.observations,
    parts: parseParts(form.parts),
  };

  return (
    <div className="intervention-detail-page">
      <Link className="intervention-back-link" to="/interventions">
        <ArrowLeft size={16} />Retour aux interventions
      </Link>

      <PageHeader
        section="PARC & MAINTENANCE"
        title={String(doc.reference)}
        description={String(doc.problemDescription || "Aucune description renseignée.")}
        actions={
          <div className="intervention-detail-actions">
            <Badge value={status} />
            {(status === "todo" || status === "planned") && (
              <button disabled={saving} className="btn btn-primary" onClick={() => patch({ status: "in_progress" })}>
                <Play size={16} />Démarrer
              </button>
            )}
            {status === "in_progress" && (
              <>
                <button disabled={saving} className="btn btn-ghost" onClick={() => patch({ status: "on_hold" })}>
                  <Pause size={16} />Mettre en attente
                </button>
                <button disabled={saving} className="btn btn-primary" onClick={() => patch({ status: "completed", ...reportBody })}>
                  <CheckCircle2 size={16} />Terminer
                </button>
              </>
            )}
            {canCancel && (
              <button disabled={saving} className="btn btn-ghost text-red-600 hover:border-red-200 hover:bg-red-50" onClick={() => patch({ status: "cancelled" })}>
                <Ban size={16} />Annuler
              </button>
            )}
          </div>
        }
      />

      {error && (
        <p className="intervention-detail-error flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300" role="alert">
          {error}
        </p>
      )}

      <section className="intervention-detail-summary" aria-label="Résumé de l’intervention">
        <article className="intervention-detail-summary-card">
          <span className="intervention-detail-summary-icon intervention-detail-summary-icon-violet"><Cpu size={19} /></span>
          <div className="min-w-0">
            <p className="intervention-detail-label">Machine</p>
            {machine?._id ? (
              <Link className="intervention-detail-value intervention-detail-machine-link" to={`/machines/${machine._id}`}>
                {machine.name || machine.code || "Voir la machine"}
              </Link>
            ) : <p className="intervention-detail-value">{machine?.name || "—"}</p>}
            {machine?.location && <p className="intervention-detail-support">{machine.location}</p>}
          </div>
        </article>
        <article className="intervention-detail-summary-card">
          <span className="intervention-detail-summary-icon intervention-detail-summary-icon-amber"><Wrench size={19} /></span>
          <div>
            <p className="intervention-detail-label">Type et priorité</p>
            <p className="intervention-detail-value">{typeLabels[String(doc.type)] ?? String(doc.type || "—")}</p>
            <p className="intervention-detail-support">Priorité : <span className="font-semibold">{priorityLabels[String(doc.priority)] ?? String(doc.priority || "—")}</span></p>
          </div>
        </article>
        <article className="intervention-detail-summary-card">
          <span className="intervention-detail-summary-icon intervention-detail-summary-icon-sky"><CalendarClock size={19} /></span>
          <div>
            <p className="intervention-detail-label">Planification</p>
            <p className="intervention-detail-value">{when(doc.scheduledAt as string)}</p>
            <p className="intervention-detail-support">Début : {when(doc.startedAt as string)}</p>
          </div>
        </article>
        <article className="intervention-detail-summary-card">
          <span className="intervention-detail-summary-icon intervention-detail-summary-icon-emerald"><Clock3 size={19} /></span>
          <div className="min-w-0">
            <p className="intervention-detail-label">Technicien affecté</p>
            <p className="intervention-detail-value">
              {technician?.firstName ? `${technician.firstName} ${technician.lastName ?? ""}` : "Non assigné"}
            </p>
            {technician?.email && <p className="intervention-detail-support">{technician.email}</p>}
            {alertId && machine?._id && <Link className="intervention-detail-related-link" to={`/alerts?machineId=${machine._id}`}>Voir les alertes de la machine</Link>}
          </div>
        </article>
      </section>

      <div className="intervention-detail-content">
        <section className="intervention-detail-panel intervention-report-panel">
          <div className="intervention-detail-panel-header">
            <span className="intervention-detail-summary-icon intervention-detail-summary-icon-violet"><FileText size={19} /></span>
            <div className="intervention-detail-panel-heading">
              <h2 className="font-semibold">Compte rendu d’intervention</h2>
              <p className="text-sm text-slate-500">Consignez le diagnostic, les actions et les observations.</p>
            </div>
          </div>
          <div className="intervention-report-field">
            <label htmlFor="intervention-diagnosis">Diagnostic</label>
            <textarea id="intervention-diagnosis" rows={3} value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} placeholder="Décrire la cause identifiée…" />
          </div>
          <div className="intervention-report-field">
            <label htmlFor="intervention-actions">Actions réalisées</label>
            <textarea id="intervention-actions" rows={3} value={form.actions} onChange={(e) => setForm({ ...form, actions: e.target.value })} placeholder="Décrire les opérations effectuées…" />
          </div>
          <div className="intervention-report-field">
            <label htmlFor="intervention-parts">Pièces utilisées</label>
            <input id="intervention-parts" value={form.parts} onChange={(e) => setForm({ ...form, parts: e.target.value })} placeholder="Ex. roulement:2, filtre:1" />
            <p className="mt-1 text-xs text-slate-500">Format : nom:quantité, séparez les pièces par une virgule.</p>
          </div>
          <div className="intervention-report-field">
            <label htmlFor="intervention-observations">Observations</label>
            <textarea id="intervention-observations" rows={3} value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} placeholder="Ajouter toute information utile au suivi…" />
          </div>
          <div className="intervention-report-footer">
            <p>Modifié le {when(doc.updatedAt as string)}</p>
            <button disabled={saving} className="btn btn-primary" onClick={() => patch(reportBody)}>
              <Save size={16} />{saving ? "Enregistrement…" : "Enregistrer le compte rendu"}
            </button>
          </div>
        </section>

        <section className="intervention-detail-panel intervention-history-panel">
          <div className="intervention-detail-panel-header">
            <span className="intervention-detail-summary-icon intervention-detail-summary-icon-sky"><History size={19} /></span>
            <div className="intervention-detail-panel-heading">
              <h2 className="font-semibold">Historique</h2>
              <p className="text-sm text-slate-500">Étapes et changements de statut.</p>
            </div>
          </div>
          {history.length === 0 ? (
            <p className="intervention-history-empty">Aucun événement enregistré pour le moment.</p>
          ) : (
            <ol className="intervention-history-list">
              {[...history].reverse().map((entry, index) => (
                <li key={`${entry.at ?? "event"}-${index}`} className="intervention-history-item">
                  <span className="intervention-history-icon"><ClipboardList size={14} /></span>
                  {index < history.length - 1 && <span className="intervention-history-line" />}
                  <div className="intervention-history-entry">
                    <p className="text-sm font-medium">
                      {entry.fromStatus && entry.toStatus ? (
                        <><Badge value={entry.fromStatus} /> <span className="mx-1 text-slate-400">→</span> <Badge value={entry.toStatus} /></>
                      ) : entry.toStatus ? <Badge value={entry.toStatus} /> : entry.action}
                    </p>
                    {entry.note && <p className="mt-1 text-xs text-slate-500">{entry.note}</p>}
                    <p className="mt-1 text-xs text-slate-400">{when(entry.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
