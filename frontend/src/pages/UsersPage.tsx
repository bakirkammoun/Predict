import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Check, Mail, Pencil, Phone, Search, ShieldCheck, UserPlus, Users, Wrench } from "lucide-react";
import { api, apiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Empty } from "../components/Empty";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { PasswordInput } from "../components/PasswordInput";
import { ListSelect } from "../components/ListSelect";
import { StatCard } from "../components/StatCard";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  maintenance_manager: "Responsable",
  technician: "Technicien",
};

function initials(user: Record<string, unknown>) {
  return `${String(user.firstName ?? "").charAt(0)}${String(user.lastName ?? "").charAt(0)}`.toUpperCase();
}

export function UsersPage() {
  const { hasRole } = useAuth();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [pendingRows, setPendingRows] = useState<Record<string, unknown>[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();

  const load = async () => {
    try {
      const usersRequest = api.get("/users?limit=100");
      const pendingRequest = hasRole("admin")
        ? api.get("/users/pending-approval")
        : Promise.resolve(null);
      const [usersResponse, pendingResponse] = await Promise.all([
        usersRequest,
        pendingRequest,
      ]);
      setRows(usersResponse.data.data);
      if (pendingResponse) setPendingRows(pendingResponse.data.data);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [hasRole]);

  const approve = async (id: string) => {
    setError("");
    try {
      await api.post(`/users/${id}/approve`);
      await load();
    } catch (e) {
      setError(apiError(e));
    }
  };

  const activeCount = rows.filter((user) => user.isActive).length;
  const technicianCount = rows.filter((user) => user.role === "technician").length;
  const filteredRows = rows.filter((user) => {
    const name = `${String(user.firstName ?? "")} ${String(user.lastName ?? "")}`.toLowerCase();
    const matchesSearch =
      name.includes(search.toLowerCase()) ||
      String(user.email ?? "").toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (!roleFilter || user.role === roleFilter);
  });

  return (
    <div className="users-page space-y-4">
      <PageHeader
        section="GESTION"
        title="Utilisateurs"
        description="Gérez les comptes, les rôles et les accès à la plateforme."
        actions={hasRole("admin") ? (
          <button
            className="btn btn-primary inline-flex items-center gap-2"
            onClick={() => {
              setError("");
              setOpen(true);
            }}
          >
            <UserPlus size={17} />
            Ajouter un utilisateur
          </button>
        ) : undefined}
      />

      <section className="users-summary" aria-label="Résumé des utilisateurs">
        <StatCard title="Comptes enregistrés" value={loading ? "—" : rows.length} icon={Users} accent="violet" />
        <StatCard title="Comptes actifs" value={loading ? "—" : activeCount} icon={ShieldCheck} accent="green" />
        <StatCard title="Techniciens" value={loading ? "—" : technicianCount} icon={Wrench} accent="blue" />
      </section>

      {hasRole("admin") && (
        <section className="users-approval-card">
          <div className="users-section-heading">
            <div className="flex items-center gap-3">
              <span className="users-approval-icon">
                <Check size={18} />
              </span>
              <div>
                <h2 className="font-semibold">Demandes à approuver</h2>
                <p className="text-sm text-slate-500">Comptes vérifiés en attente d’activation.</p>
              </div>
            </div>
            <span className="users-pending-count">
              {pendingRows.length} en attente
            </span>
          </div>
          {pendingRows.length === 0 ? (
            <p className="users-approval-empty">Aucune demande en attente.</p>
          ) : (
            <ul className="users-pending-list">
              {pendingRows.map((user) => (
                <li key={String(user._id)} className="users-pending-item">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="users-avatar users-avatar-pending">
                      {initials(user)}
                    </span>
                    <div className="min-w-0">
                      <p className="users-person-name">{String(user.firstName)} {String(user.lastName)}</p>
                      <p className="users-person-meta">
                        {String(user.email)} · {ROLE_LABELS[String(user.role)] ?? String(user.role)}
                      </p>
                    </div>
                  </div>
                  <button className="btn btn-ghost users-approve-button" onClick={() => approve(String(user._id))}>
                    <Check size={16} />
                    Approuver
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="users-team-card">
        <div className="users-team-toolbar">
          <div>
            <h2>Membres de l’équipe</h2>
            <p>{filteredRows.length} compte{filteredRows.length > 1 ? "s" : ""} affiché{filteredRows.length > 1 ? "s" : ""}</p>
          </div>
          <div className="users-filters">
            <label className="users-search">
              <Search size={16} aria-hidden="true" />
              <input
                className="users-search-input"
                placeholder="Rechercher un membre…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Rechercher un membre"
              />
            </label>
            <ListSelect
              className="users-role-filter"
              value={roleFilter}
              onChange={setRoleFilter}
              ariaLabel="Filtrer par rôle"
              options={[
                { value: "", label: "Tous les rôles" },
                { value: "admin", label: "Administrateur" },
                { value: "maintenance_manager", label: "Responsable" },
                { value: "technician", label: "Technicien" },
              ]}
            />
          </div>
        </div>
        {error && <p className="users-error" role="alert">{error}</p>}
        {loading ? (
          <p className="users-loading" role="status">Chargement des utilisateurs…</p>
        ) : filteredRows.length === 0 ? (
          <div className="users-empty">
            <Empty
              title={rows.length ? "Aucun résultat" : "Aucun utilisateur"}
              hint={rows.length ? "Modifiez votre recherche ou le filtre sélectionné." : undefined}
            />
          </div>
        ) : (
          <div className="users-member-grid">
            {filteredRows.map((user) => (
              <article className="users-member-card" key={String(user._id)}>
                <div className="users-member-card-top">
                  <span className={`users-avatar users-member-avatar users-member-avatar-${String(user.role)}`}>
                    {initials(user)}
                  </span>
                  <span className={`users-account-status ${user.isActive ? "users-account-active" : "users-account-disabled"}`}>
                    <span />
                    {user.isActive ? "Actif" : "Désactivé"}
                  </span>
                </div>
                <div className="users-member-identity">
                  <h3>{String(user.firstName)} {String(user.lastName)}</h3>
                  <span className={`users-role-badge users-role-${String(user.role)}`}>
                    {ROLE_LABELS[String(user.role)] ?? String(user.role)}
                  </span>
                </div>
                <div className="users-member-contact">
                  <p title={String(user.email)}>
                    <Mail size={15} aria-hidden="true" />
                    <span>{String(user.email)}</span>
                  </p>
                  {Boolean(user.phone) && (
                    <p title={String(user.phone)}>
                      <Phone size={15} aria-hidden="true" />
                      <span>{String(user.phone)}</span>
                    </p>
                  )}
                </div>
                {hasRole("admin") && (
                  <button
                    className="users-member-edit"
                    onClick={() => { setError(""); setEditing(user); }}
                    aria-label={`Modifier le compte de ${String(user.firstName)} ${String(user.lastName)}`}
                  >
                    <Pencil size={15} />
                    Modifier le compte
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      {open && (
        <Modal title="Nouvel utilisateur" onClose={() => setOpen(false)}>
          <form
            className="space-y-2"
            onSubmit={handleSubmit(async (v) => {
              setError("");
              try {
                await api.post("/users", v);
                setOpen(false);
                reset();
                load();
              } catch (e) {
                setError(apiError(e));
              }
            })}
          >
            <label htmlFor="new-user-first-name">Prénom</label>
            <input id="new-user-first-name" autoComplete="given-name" aria-invalid={Boolean(errors.firstName)} {...register("firstName", { required: "Le prénom est obligatoire." })} />
            {errors.firstName && <p className="text-sm text-red-600" role="alert">{String(errors.firstName.message)}</p>}
            <label htmlFor="new-user-last-name">Nom</label>
            <input id="new-user-last-name" autoComplete="family-name" aria-invalid={Boolean(errors.lastName)} {...register("lastName", { required: "Le nom est obligatoire." })} />
            {errors.lastName && <p className="text-sm text-red-600" role="alert">{String(errors.lastName.message)}</p>}
            <label htmlFor="new-user-email">Email</label>
            <input id="new-user-email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} {...register("email", { required: "L’adresse e-mail est obligatoire.", pattern: { value: /^\S+@\S+\.\S+$/, message: "Saisissez une adresse e-mail valide." } })} />
            {errors.email && <p className="text-sm text-red-600" role="alert">{String(errors.email.message)}</p>}
            <label htmlFor="new-user-password">Mot de passe (8 caractères minimum)</label>
            <PasswordInput
              id="new-user-password"
              autoComplete="new-password"
              minLength={8}
              aria-invalid={Boolean(errors.password)}
              {...register("password", { required: "Le mot de passe est obligatoire.", minLength: { value: 8, message: "Le mot de passe doit contenir au moins 8 caractères." } })}
            />
            {errors.password && <p className="text-sm text-red-600" role="alert">{String(errors.password.message)}</p>}
            <label id="new-user-role-label">Rôle</label>
            <Controller
              control={control}
              name="role"
              defaultValue="technician"
              render={({ field }) => (
                <ListSelect
                  ariaLabel="Rôle du nouvel utilisateur"
                  ariaLabelledBy="new-user-role-label"
                  value={String(field.value)}
                  onChange={field.onChange}
                  options={[
                    { value: "technician", label: "Technicien" },
                    { value: "maintenance_manager", label: "Responsable" },
                    { value: "admin", label: "Administrateur" },
                  ]}
                />
              )}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button className="btn btn-primary">Enregistrer</button>
          </form>
        </Modal>
      )}
      {editing && (
        <Modal title="Modifier l'utilisateur" onClose={() => setEditing(null)}>
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setError("");
              try {
                const password = String(fd.get("password") ?? "");
                await api.patch(`/users/${editing._id}`, {
                  firstName: fd.get("firstName"),
                  lastName: fd.get("lastName"),
                  phone: fd.get("phone"),
                  role: fd.get("role"),
                  isActive: fd.get("isActive") === "true",
                  ...(password.length >= 8 ? { password } : {}),
                });
                setEditing(null);
                load();
              } catch (err) {
                setError(apiError(err));
              }
            }}
          >
            <label>Prénom</label>
            <input
              name="firstName"
              defaultValue={String(editing.firstName)}
              required
            />
            <label>Nom</label>
            <input
              name="lastName"
              defaultValue={String(editing.lastName)}
              required
            />
            <label>Téléphone</label>
            <input name="phone" defaultValue={String(editing.phone ?? "")} />
            <label id="edit-user-role-label">Rôle</label>
            <ListSelect
              name="role"
              defaultValue={String(editing.role)}
              ariaLabel="Rôle de l’utilisateur"
              ariaLabelledBy="edit-user-role-label"
              options={[
                { value: "technician", label: "Technicien" },
                { value: "maintenance_manager", label: "Responsable" },
                { value: "admin", label: "Administrateur" },
              ]}
            />
            <label id="edit-user-status-label">Compte</label>
            <ListSelect
              name="isActive"
              defaultValue={editing.isActive ? "true" : "false"}
              ariaLabel="État du compte"
              ariaLabelledBy="edit-user-status-label"
              options={[
                { value: "true", label: "Actif" },
                { value: "false", label: "Désactivé" },
              ]}
            />
            <label>Nouveau mot de passe (optionnel)</label>
            <PasswordInput name="password" autoComplete="new-password" minLength={8} />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button className="btn btn-primary">Enregistrer</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
