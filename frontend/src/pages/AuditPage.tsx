import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Clock3, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import { api, apiError } from "../lib/api";
import { Empty } from "../components/Empty";
import { ListSelect } from "../components/ListSelect";
import { PageHeader } from "../components/PageHeader";
import { when } from "../lib/format";

const PAGE_SIZE = 20;
const RESOURCE_OPTIONS = [
  { value: "", label: "Toutes les ressources" },
  { value: "alert", label: "Alertes" },
  { value: "device", label: "Appareils" },
  { value: "intervention", label: "Interventions" },
  { value: "machine", label: "Machines" },
  { value: "settings", label: "Paramètres" },
  { value: "simulation", label: "Simulation" },
  { value: "user", label: "Utilisateurs" },
];

const ACTION_LABELS: Record<string, string> = {
  "alert.status": "Modification du statut d’une alerte",
  "auth.bootstrap": "Création du compte administrateur",
  "auth.login": "Connexion",
  "auth.logout": "Déconnexion",
  "device.revoke": "Révocation d’un appareil",
  "device.rotate_secret": "Renouvellement de la clé d’un appareil",
  "intervention.create": "Création d’une intervention",
  "intervention.update": "Modification d’une intervention",
  "machine.create": "Ajout d’une machine",
  "machine.deactivate": "Désactivation d’une machine",
  "machine.update": "Modification d’une machine",
  "settings.update": "Modification des paramètres",
  "simulation.scenario": "Application d’un scénario",
  "simulation.start": "Démarrage du simulateur",
  "simulation.stop": "Arrêt du simulateur",
  "user.approve": "Approbation d’un utilisateur",
  "user.create": "Création d’un utilisateur",
  "user.update": "Modification d’un utilisateur",
};

const RESOURCE_LABELS: Record<string, string> = {
  alert: "Alerte",
  device: "Appareil",
  intervention: "Intervention",
  machine: "Machine",
  settings: "Paramètres",
  simulation: "Simulation",
  user: "Utilisateur",
};

type AuditEvent = {
  _id: string;
  actorEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  createdAt: string;
};

export function AuditPage() {
  const [rows, setRows] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [resource, setResource] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastItem = Math.min(page * PAGE_SIZE, total);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (resource) query.set("resource", resource);

    setLoading(true);
    setError("");
    api.get(`/audit?${query.toString()}`, { signal: controller.signal })
      .then((response) => {
        setRows(response.data.data);
        setTotal(response.data.meta.total);
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) setError(apiError(requestError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [page, resource, reloadKey]);

  const refresh = () => {
    setReloadKey((current) => current + 1);
  };

  return (
    <div className="audit-page">
      <PageHeader
        section="GESTION"
        title="Journaux"
        description="Consultez les actions enregistrées dans le journal d’audit."
      />

      <section className="audit-overview" aria-label="Résumé du journal">
        <div className="audit-overview-icon"><ShieldCheck size={20} /></div>
        <div className="audit-overview-copy">
          <p className="audit-overview-value">{total.toLocaleString("fr-FR")}</p>
          <p className="audit-overview-label">événement{total > 1 ? "s" : ""} enregistré{total > 1 ? "s" : ""}</p>
        </div>
        <span className="audit-overview-note"><Clock3 size={15} /> Activité récente</span>
      </section>

      {error && <p className="audit-error" role="alert">{error}</p>}

      <section className="audit-list-panel">
        <div className="audit-list-heading">
          <div>
            <h2>Historique des actions</h2>
            <p>Les événements les plus récents apparaissent en premier.</p>
          </div>
          <button className="btn btn-ghost audit-refresh" type="button" onClick={refresh} disabled={loading}>
            <RefreshCw size={16} className={loading ? "audit-refreshing" : ""} />
            Actualiser
          </button>
        </div>

        <div className="audit-toolbar">
          <label id="audit-resource-filter-label">Filtrer par ressource</label>
          <ListSelect
            value={resource}
            onChange={(value) => {
              setResource(value);
              setPage(1);
            }}
            ariaLabel="Filtrer par ressource"
            ariaLabelledBy="audit-resource-filter-label"
            className="audit-resource-filter"
            options={RESOURCE_OPTIONS}
          />
          <span className="audit-result-count" aria-live="polite">
            {loading ? "Chargement…" : total === 0 ? "Aucun résultat" : `${firstItem}–${lastItem} sur ${total}`}
          </span>
        </div>

        {loading ? (
          <div className="audit-loading" role="status">Chargement des événements…</div>
        ) : error ? null : rows.length === 0 ? (
          <Empty
            title={resource ? "Aucun événement pour cette ressource" : "Aucun événement"}
            hint={resource ? "Essayez un autre filtre pour consulter le journal." : "Les actions enregistrées apparaîtront ici."}
          />
        ) : (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th scope="col">Date et heure</th>
                  <th scope="col">Acteur</th>
                  <th scope="col">Action</th>
                  <th scope="col">Ressource</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id}>
                    <td className="audit-date" data-label="Date et heure">{when(row.createdAt)}</td>
                    <td data-label="Acteur">
                      <span className="audit-actor">
                        <span className="audit-actor-icon"><UserRound size={15} /></span>
                        <span>{row.actorEmail || "Système"}</span>
                      </span>
                    </td>
                    <td data-label="Action">
                      <span className="audit-action" title={row.action}>
                        {ACTION_LABELS[row.action] ?? row.action.replace(/[._]/g, " ")}
                      </span>
                    </td>
                    <td data-label="Ressource">
                      <span className="audit-resource">
                        <span className="audit-resource-type">{RESOURCE_LABELS[row.resource] ?? row.resource}</span>
                        {row.resourceId && <code title={row.resourceId}>{row.resourceId}</code>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && total > PAGE_SIZE && (
          <nav className="audit-pagination" aria-label="Pagination du journal">
            <button
              className="btn btn-ghost"
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft size={16} /> Précédent
            </button>
            <span aria-live="polite">Page {page} sur {pageCount}</span>
            <button
              className="btn btn-ghost"
              type="button"
              disabled={page >= pageCount}
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            >
              Suivant <ChevronRight size={16} />
            </button>
          </nav>
        )}
      </section>
    </div>
  );
}
