import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { api, apiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Badge } from "../components/Badge";
import { Empty } from "../components/Empty";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { PasswordInput } from "../components/PasswordInput";
import { ListSelect } from "../components/ListSelect";

export interface Machine {
  _id: string;
  name: string;
  code: string;
  type: string;
  location: string;
  healthStatus: string;
  operationalStatus: string;
  assignedTechnicianId?: { firstName: string; lastName: string };
}

const machineIllustrations = [
  { src: "/images/factory-automation.jpg", alt: "Robot industriel sur une ligne de production" },
  { src: "/images/maintenance-technician.jpg", alt: "Technicien examinant un équipement industriel" },
  { src: "/images/sensor-maintenance.jpg", alt: "Intervention sur un composant électronique industriel" },
];

export function MachinesPage() {
  const { hasRole } = useAuth();
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<Machine[]>([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const page = Number(params.get("page") ?? 1);

  const load = async () => {
    const q = new URLSearchParams(params);
    setLoading(true);
    setError("");
    setItems([]);
    setTotal(0);
    try {
      const r = await api.get(`/machines?${q.toString()}`);
      setItems(r.data.data);
      setTotal(r.data.meta.total);
    } catch (requestError) {
      setError(apiError(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [params]);

  return (
    <div className="machines-page space-y-4">
      <PageHeader
        section="PARC & MAINTENANCE"
        title="Parc des machines"
        description="Consultez l’état, l’emplacement et le technicien responsable de chaque équipement."
        actions={hasRole("admin") ? (
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            Ajouter
          </button>
        ) : undefined}
      />
      <div className="page-filter-bar machines-filter-bar">
        <input
          defaultValue={params.get("search") ?? ""}
          placeholder="Nom ou code"
          onBlur={(e) => {
            params.set("search", e.target.value);
            params.set("page", "1");
            setParams(params);
          }}
        />
        <ListSelect
          ariaLabel="Filtrer par état"
          value={params.get("status") ?? ""}
          onChange={(value) => setParams({ ...Object.fromEntries(params), status: value, page: "1" })}
          options={[
            { value: "", label: "Tous les états" },
            { value: "normal", label: "Normal" },
            { value: "warning", label: "Vigilance" },
            { value: "critical", label: "Critique" },
            { value: "offline", label: "Hors ligne" },
            { value: "sensor_error", label: "Capteur en erreur" },
          ]}
        />
        <input
          defaultValue={params.get("location") ?? ""}
          placeholder="Localisation"
          onBlur={(e) => {
            params.set("location", e.target.value);
            params.set("page", "1");
            setParams(params);
          }}
        />
        <input
          defaultValue={params.get("type") ?? ""}
          placeholder="Type"
          onBlur={(e) => {
            params.set("type", e.target.value);
            params.set("page", "1");
            setParams(params);
          }}
        />
        <ListSelect
          ariaLabel="Trier les machines"
          value={params.get("sort") ?? ""}
          onChange={(value) => setParams({ ...Object.fromEntries(params), sort: value })}
          options={[
            { value: "", label: "Tri : nom" },
            { value: "health", label: "Tri : état" },
          ]}
        />
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {loading && items.length === 0 ? (
        <p role="status">Chargement des machines…</p>
      ) : error && items.length === 0 ? (
        <Empty title="Le parc machines n’a pas pu être chargé" />
      ) : items.length === 0 ? (
        <Empty title="Aucune machine" hint="Créez une machine ou exécutez le seed de démonstration." />
      ) : (
        <div className="machine-grid">
          {items.map((m, index) => {
            const illustration = machineIllustrations[index % machineIllustrations.length];
            return (
              <article className="machine-card" key={m._id}>
                <div className="machine-card-image">
                  <img
                    src={illustration.src}
                    alt={illustration.alt}
                    loading="lazy"
                  />
                  <span className="machine-card-code">{m.code}</span>
                  <span className="machine-card-illustrative">Illustration</span>
                  <Badge value={m.healthStatus} />
                </div>
                <div className="machine-card-body">
                  <div className="machine-card-heading">
                    <div className="min-w-0">
                      <h2 title={m.name}>{m.name}</h2>
                      <p>{m.type}</p>
                    </div>
                    <span className={`machine-operational-state machine-operational-${m.operationalStatus}`}>
                      {m.operationalStatus === "active" ? "En service" : "Hors service"}
                    </span>
                  </div>
                  <dl className="machine-card-details">
                    <div><dt>Localisation</dt><dd>{m.location || "—"}</dd></div>
                    <div>
                      <dt>Technicien</dt>
                      <dd>{m.assignedTechnicianId
                        ? `${m.assignedTechnicianId.firstName} ${m.assignedTechnicianId.lastName}`
                        : "Non assigné"}</dd>
                    </div>
                  </dl>
                  <Link className="machine-card-link" to={`/machines/${m._id}`}>
                    Voir les détails <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <div className="flex gap-2">
        <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setParams({ ...Object.fromEntries(params), page: String(page - 1) })}>
          Précédent
        </button>
        <span className="py-2 text-sm">{page} / {Math.max(1, Math.ceil(total / 20))}</span>
        <button
          className="btn btn-ghost"
          disabled={page * 20 >= total}
          onClick={() => setParams({ ...Object.fromEntries(params), page: String(page + 1) })}
        >
          Suivant
        </button>
      </div>
      {open && (
        <Modal title="Nouvelle machine" onClose={() => setOpen(false)}>
          <form
            className="space-y-2"
            onSubmit={handleSubmit(async (v) => {
              setError("");
              try {
                await api.post("/machines", v);
                setOpen(false);
                reset();
                load();
              } catch (e) {
                setError(apiError(e));
              }
            })}
          >
            <label htmlFor="machine-name">Nom</label>
            <input id="machine-name" aria-invalid={Boolean(errors.name)} {...register("name", { required: "Le nom est obligatoire." })} />
            {errors.name && <p className="text-sm text-red-600" role="alert">{String(errors.name.message)}</p>}
            <label htmlFor="machine-code">Code</label>
            <input id="machine-code" aria-invalid={Boolean(errors.code)} {...register("code", { required: "Le code est obligatoire." })} />
            {errors.code && <p className="text-sm text-red-600" role="alert">{String(errors.code.message)}</p>}
            <label htmlFor="machine-type">Type</label>
            <input id="machine-type" aria-invalid={Boolean(errors.type)} {...register("type", { required: "Le type est obligatoire." })} />
            {errors.type && <p className="text-sm text-red-600" role="alert">{String(errors.type.message)}</p>}
            <label htmlFor="machine-location">Localisation</label>
            <input id="machine-location" aria-invalid={Boolean(errors.location)} {...register("location", { required: "La localisation est obligatoire." })} />
            {errors.location && <p className="text-sm text-red-600" role="alert">{String(errors.location.message)}</p>}
            <label htmlFor="machine-hardware-id">Identifiant ESP32</label>
            <input id="machine-hardware-id" aria-invalid={Boolean(errors.hardwareId)} {...register("hardwareId", { required: "L’identifiant matériel est obligatoire." })} placeholder="ESP32-004" />
            {errors.hardwareId && <p className="text-sm text-red-600" role="alert">{String(errors.hardwareId.message)}</p>}
            <label htmlFor="machine-device-secret">Secret appareil (8 caractères minimum)</label>
            <PasswordInput
              id="machine-device-secret"
              autoComplete="new-password"
              minLength={8}
              aria-invalid={Boolean(errors.deviceSecret)}
              {...register("deviceSecret", {
                required: "Le secret appareil est obligatoire.",
                minLength: { value: 8, message: "Le secret doit contenir au moins 8 caractères." },
              })}
            />
            {errors.deviceSecret && <p className="text-sm text-red-600" role="alert">{String(errors.deviceSecret.message)}</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button className="btn btn-primary mt-3">Enregistrer</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
