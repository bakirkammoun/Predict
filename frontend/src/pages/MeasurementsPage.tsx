import { useEffect, useState } from "react";
import { api, apiError } from "../lib/api";
import { Empty } from "../components/Empty";
import { when } from "../lib/format";
import { Badge } from "../components/Badge";
import { usePeriod } from "../lib/period";
import { PageHeader } from "../components/PageHeader";
import { ListSelect } from "../components/ListSelect";

export function MeasurementsPage() {
  const { query } = usePeriod();
  const [machines, setMachines] = useState<{ _id: string; name: string }[]>([]);
  const [machineId, setMachineId] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [machinesLoading, setMachinesLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [machinesError, setMachinesError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    api.get("/machines?limit=100", { signal: controller.signal }).then((r) => {
      setMachines(r.data.data);
      if (r.data.data[0]) setMachineId(r.data.data[0]._id);
      setMachinesError("");
    }).catch((requestError) => {
      if (!controller.signal.aborted) setMachinesError(apiError(requestError));
    }).finally(() => {
      if (!controller.signal.aborted) setMachinesLoading(false);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (!machineId) {
      setRows([]);
      setTotal(0);
      setLoading(false);
      return () => controller.abort();
    }
    setLoading(true);
    setError("");
    setRows([]);
    setTotal(0);
    let requestInFlight = false;
    const loadMeasurements = async (initialLoad = false) => {
      if (requestInFlight || controller.signal.aborted) return;
      requestInFlight = true;
      if (initialLoad) setLoading(true);
      try {
        const response = await api.get(
          `/machines/${machineId}/measurements?limit=50&page=${page}&${query}`,
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) {
          setRows(response.data.data);
          setTotal(response.data.meta.total);
          setError("");
        }
      } catch (requestError) {
        if (!controller.signal.aborted) setError(apiError(requestError));
      } finally {
        requestInFlight = false;
        if (initialLoad && !controller.signal.aborted) setLoading(false);
      }
    };

    void loadMeasurements(true);
    const refreshTimer = window.setInterval(() => {
      void loadMeasurements();
    }, 5000);
    return () => {
      window.clearInterval(refreshTimer);
      controller.abort();
    };
  }, [machineId, page, query]);

  return (
    <div className="space-y-4">
      <PageHeader
        section="PARC & MAINTENANCE"
        title="Mesures"
        description="Historique des données transmises par les capteurs de vos machines."
      />
      <div className="page-filter-bar">
        <label id="measurement-machine-label">Machine</label>
        <ListSelect
          ariaLabel="Choisir la machine pour consulter les mesures"
          ariaLabelledBy="measurement-machine-label"
          value={machineId}
          onChange={(value) => {
            setMachineId(value);
            setPage(1);
          }}
          disabled={machines.length === 0}
          options={machines.map((machine) => ({ value: machine._id, label: machine.name }))}
        />
      </div>
      {machinesError && <p className="text-sm text-red-600" role="alert">{machinesError}</p>}
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {loading || machinesLoading ? (
        <p role="status">Chargement des mesures…</p>
      ) : error ? (
        <Empty title="Les mesures n’ont pas pu être chargées" />
      ) : machinesError ? (
        <Empty title="La liste des machines n’a pas pu être chargée" />
      ) : rows.length === 0 ? (
        <Empty
          title={machines.length === 0 ? "Aucune machine accessible" : "Aucune mesure"}
          hint={machines.length === 0 ? undefined : "Démarrez le simulateur ou connectez un ESP32."}
        />
      ) : (
        <div className="page-table-wrap">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr>
                <th className="p-3">Date</th>
                <th>Vibration</th>
                <th>Temp.</th>
                <th>Humidité</th>
                <th>Courant</th>
                <th>Source</th>
                <th>Validation</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r._id)} className="border-t">
                  <td className="p-3">{when(r.measuredAt as string)}</td>
                  <td>
                    {(r.vibration as { value: number; unit?: string }).value}{" "}
                    {(r.vibration as { unit?: string }).unit ?? "g"}
                  </td>
                  <td>
                    {(r.temperature as { value: number }).value}{" "}
                    {(r.temperature as { unit?: string }).unit === "C" ? "°C" : (r.temperature as { unit?: string }).unit}
                  </td>
                  <td>
                    {r.humidity
                      ? `${(r.humidity as { value: number }).value} ${(r.humidity as { unit?: string }).unit ?? "%"}`
                      : "—"}
                  </td>
                  <td>
                    {(r.current as { value: number }).value} {(r.current as { unit?: string }).unit ?? "A"}
                  </td>
                  <td>
                    <Badge value={String(r.source)} />
                  </td>
                  <td>
                    <Badge value={String(r.validationStatus)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="page-pagination">
        <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Précédent
        </button>
        <span className="py-2 text-sm">
          {page} / {Math.max(1, Math.ceil(total / 50))}
        </span>
        <button className="btn btn-ghost" disabled={page * 50 >= total} onClick={() => setPage((p) => p + 1)}>
          Suivant
        </button>
      </div>
    </div>
  );
}
