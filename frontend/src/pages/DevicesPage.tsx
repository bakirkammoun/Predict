import { useEffect, useMemo, useState } from "react";
import { Cpu, Search, ShieldAlert, Wifi, WifiOff } from "lucide-react";
import { api, apiError } from "../lib/api";
import { Empty } from "../components/Empty";
import { when } from "../lib/format";
import { PageHeader } from "../components/PageHeader";
import { ListSelect } from "../components/ListSelect";
import { StatCard } from "../components/StatCard";

type DeviceRow = {
  _id: string;
  hardwareId: string;
  name?: string;
  machineId?: { name?: string; code?: string };
  status: "online" | "offline";
  lastSeenAt?: string;
  revoked: boolean;
  firmwareVersion?: string;
};

function deviceState(device: DeviceRow) {
  if (device.revoked) return { label: "Révoqué", className: "device-status-revoked" };
  if (device.status === "online") return { label: "Connecté", className: "device-status-online" };
  return { label: "Hors ligne", className: "device-status-offline" };
}

export function DevicesPage() {
  const [rows, setRows] = useState<DeviceRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setError("");
    try {
      const response = await api.get("/devices");
      setRows(response.data.data);
    } catch (requestError) {
      setError(apiError(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onlineCount = rows.filter((device) => !device.revoked && device.status === "online").length;
  const offlineCount = rows.filter((device) => !device.revoked && device.status !== "online").length;
  const revokedCount = rows.filter((device) => device.revoked).length;
  const filteredRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("fr");
    return rows.filter((device) => {
      const matchesSearch = !term || [
        device.name,
        device.hardwareId,
        device.machineId?.name,
        device.machineId?.code,
      ].some((value) => value?.toLocaleLowerCase("fr").includes(term));
      const state = device.revoked ? "revoked" : device.status;
      return matchesSearch && (!statusFilter || state === statusFilter);
    });
  }, [rows, search, statusFilter]);

  return (
    <div className="devices-page space-y-4">
      <PageHeader
        section="GESTION"
        title="Appareils IoT"
        description="Suivez les équipements connectés et contrôlez leur accès à la télémétrie."
      />

      <section className="devices-summary" aria-label="Résumé des appareils IoT">
        <StatCard title="Appareils enregistrés" value={loading ? "—" : rows.length} icon={Cpu} hint="Équipements IoT" accent="violet" />
        <StatCard title="Connectés" value={loading ? "—" : onlineCount} icon={Wifi} hint="Transmission active" accent="green" />
        <StatCard title="Hors ligne" value={loading ? "—" : offlineCount} icon={WifiOff} hint="À vérifier" accent="blue" />
        <StatCard title="Révoqués" value={loading ? "—" : revokedCount} icon={ShieldAlert} hint="Accès bloqué" accent="orange" />
      </section>

      {error && <p className="devices-error" role="alert">{error}</p>}

      <section className="devices-list-card" aria-label="Liste des appareils IoT">
        <div className="devices-toolbar">
          <div>
            <h2>Inventaire des appareils</h2>
            <p>{loading ? "Chargement…" : `${filteredRows.length} appareil${filteredRows.length === 1 ? "" : "s"} affiché${filteredRows.length === 1 ? "" : "s"}`}</p>
          </div>
          <div className="devices-filters">
            <label className="devices-search">
              <Search size={16} aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un appareil…"
                aria-label="Rechercher par identifiant, nom ou machine"
              />
            </label>
            <ListSelect
              className="devices-status-filter"
              value={statusFilter}
              onChange={setStatusFilter}
              ariaLabel="Filtrer par état de l’appareil"
              options={[
                { value: "", label: "Tous les états" },
                { value: "online", label: "Connecté" },
                { value: "offline", label: "Hors ligne" },
                { value: "revoked", label: "Révoqué" },
              ]}
            />
          </div>
        </div>

        {loading ? (
          <p className="devices-loading" role="status">Chargement des appareils…</p>
        ) : filteredRows.length === 0 ? (
          <div className="devices-empty">
            <Empty
              title={rows.length ? "Aucun résultat" : "Aucun appareil enregistré"}
              hint={rows.length ? "Modifiez votre recherche ou le filtre sélectionné." : "Les appareils enregistrés apparaîtront ici."}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="devices-table">
              <thead>
                <tr>
                  <th>Appareil</th>
                  <th>Machine associée</th>
                  <th>État</th>
                  <th>Dernière communication</th>
                  <th>Firmware</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((device) => {
                  const state = deviceState(device);
                  return (
                    <tr key={device._id}>
                      <td>
                        <div className="device-identity">
                          <span className="device-mark"><Cpu size={17} /></span>
                          <span>
                            <strong>{device.name || device.hardwareId}</strong>
                            <small>{device.hardwareId}</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="device-machine-name">{device.machineId?.name || "Non associée"}</span>
                        {device.machineId?.code && <small className="device-machine-code">{device.machineId.code}</small>}
                      </td>
                      <td>
                        <span className={`device-status ${state.className}`}>
                          <span />
                          {state.label}
                        </span>
                      </td>
                      <td className="device-last-seen">{when(device.lastSeenAt)}</td>
                      <td><span className="device-firmware">{device.firmwareVersion || "—"}</span></td>
                      <td>
                        {!device.revoked ? (
                          <button
                            className="btn btn-ghost device-revoke-button"
                            onClick={async () => {
                              if (!confirm(`Révoquer l’accès de « ${device.name || device.hardwareId} » ? Cet appareil ne pourra plus transmettre de télémétrie.`)) return;
                              setError("");
                              try {
                                await api.post(`/devices/${device._id}/revoke`);
                                await load();
                              } catch (requestError) {
                                setError(apiError(requestError));
                              }
                            }}
                          >
                            Révoquer
                          </button>
                        ) : <span className="device-revoked-label">Accès bloqué</span>}
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
