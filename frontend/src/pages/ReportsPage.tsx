import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Activity, Gauge, Wrench } from "lucide-react";
import { api, apiError } from "../lib/api";
import { Empty } from "../components/Empty";
import { pct } from "../lib/format";
import { Badge } from "../components/Badge";
import { usePeriod } from "../lib/period";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/StatCard";

type ReportRow = {
  machineId: string;
  name: string;
  code?: string;
  healthStatus: string;
  operationalStatus: "active" | "inactive";
  alerts: number;
  interventions: number;
  samples: number;
  availability: number | null;
  heuristicRisk?: number | null;
  heuristicNote?: string;
};

export function ReportsPage() {
  const { query, hours } = usePeriod();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api.get(`/reports?${query}`)
      .then((response) => {
        if (active) setRows(response.data.data.rows);
      })
      .catch((requestError) => {
        if (active) setError(apiError(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query]);

  const summary = useMemo(() => ({
    alerts: rows.reduce((sum, row) => sum + Number(row.alerts || 0), 0),
    interventions: rows.reduce((sum, row) => sum + Number(row.interventions || 0), 0),
    availability: rows.filter((row) => row.operationalStatus === "active").length
      ? rows.reduce(
          (sum, row) => sum + (row.operationalStatus === "active" ? Number(row.availability ?? 0) : 0),
          0,
        ) / rows.filter((row) => row.operationalStatus === "active").length
      : 0,
  }), [rows]);

  const periodLabel = hours === 24 ? "24 dernières heures" : `${hours / 24} derniers jours`;

  return (
    <div className="reports-page space-y-4">
      <PageHeader
        section="GESTION"
        title="Rapports"
        description={`Synthèse de l’activité et de l’état du parc · ${periodLabel}`}
      />

      <section className="reports-summary" aria-label="Résumé des rapports">
        <StatCard
          title="Équipements du parc"
          value={loading ? "—" : rows.length}
          icon={Activity}
          hint="Équipements enregistrés"
          accent="violet"
        />
        <StatCard
          title="Alertes sur la période"
          value={loading ? "—" : summary.alerts}
          icon={AlertTriangle}
          hint="À examiner par l’équipe"
          accent="blue"
        />
        <StatCard
          title="Interventions créées"
          value={loading ? "—" : summary.interventions}
          icon={Wrench}
          hint="Suivi par les techniciens"
          accent="orange"
        />
        <StatCard
          title="Disponibilité moyenne"
          value={loading ? "—" : pct(summary.availability)}
          icon={Gauge}
          hint="Sur la période · machines en service"
          accent="green"
        />
      </section>

      <aside className="reports-method-note">
        <AlertTriangle size={17} />
        <p>
          <strong>À propos du risque heuristique :</strong> cet indicateur est fondé sur les écarts aux seuils.
          Il ne représente pas une probabilité scientifique de panne ni un modèle prédictif validé.
        </p>
      </aside>

      {error && <p className="reports-error" role="alert">{error}</p>}

      <section className="reports-table-card" aria-label="Rapport par machine">
        <div className="reports-table-heading">
          <div>
            <h2>État par machine</h2>
            <p>Alertes et mesures sur la période ; l’état et le risque sont les valeurs actuelles.</p>
          </div>
          <span>{loading ? "Chargement…" : `${rows.length} machine${rows.length === 1 ? "" : "s"}`}</span>
        </div>
        {loading ? (
          <p className="reports-loading" role="status">Chargement des rapports…</p>
        ) : error ? (
          <div className="reports-empty"><Empty title="Le rapport n’a pas pu être chargé" /></div>
        ) : rows.length === 0 ? (
          <div className="reports-empty"><Empty title="Aucune machine accessible" hint="Aucune donnée n’est disponible pour cette période." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Machine</th>
                  <th>État actuel</th>
                  <th>Alertes</th>
                  <th>Interventions</th>
                  <th>Mesures</th>
                  <th>Disponibilité</th>
                  <th>Risque heuristique</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const risk = Number(row.heuristicRisk);
                  return (
                    <tr key={row.machineId}>
                      <td>
                        <Link className="reports-machine-link" to={`/machines/${row.machineId}`}>
                          <span className="reports-machine-mark"><Activity size={16} /></span>
                          <span>
                            <strong>{row.name}</strong>
                            {row.code && <small>{row.code}</small>}
                          </span>
                        </Link>
                      </td>
                      <td>
                        {row.operationalStatus === "inactive"
                          ? <Badge value="inactive" />
                          : <Badge value={String(row.healthStatus)} />}
                      </td>
                      <td><span className={row.alerts > 0 ? "reports-count reports-count-alert" : "reports-count"}>{row.alerts}</span></td>
                      <td><span className="reports-count">{row.interventions}</span></td>
                      <td><span className="reports-count">{row.samples}</span></td>
                      <td>
                        <div className="reports-availability">
                          <span>{row.operationalStatus === "inactive" || row.availability === null ? "—" : pct(Number(row.availability))}</span>
                          <span className="reports-progress" aria-hidden="true">
                            <span style={{ width: `${Math.min(100, Math.max(0, Number(row.availability ?? 0) * 100))}%` }} />
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="reports-risk-value">{Number.isFinite(risk) ? `${risk} / 100` : "—"}</span>
                        <span className="reports-risk-caption">Score indicatif / 100</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
