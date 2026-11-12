import { useState } from "react";
import { AlertCircle, CheckCircle2, KeyRound, LockKeyhole, Mail, Phone, Save, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "../lib/auth";
import { api, apiError } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { PasswordInput } from "../components/PasswordInput";

export function ProfilePage() {
  const { user } = useAuth();
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [msg, setMsg] = useState("");
  const [msgIsError, setMsgIsError] = useState(false);
  const initials = `${user?.firstName?.charAt(0) ?? ""}${user?.lastName?.charAt(0) ?? ""}`.toUpperCase();
  const roleLabels: Record<string, string> = {
    admin: "Administrateur",
    maintenance_manager: "Responsable maintenance",
    technician: "Technicien",
  };

  return (
    <div className="profile-page">
      <PageHeader section="COMPTE" title="Profil" description="Gérez vos coordonnées et la sécurité de votre compte." />

      <section className="profile-identity" aria-label="Résumé du compte">
        <span className="profile-avatar">
          {initials || <UserRound size={26} />}
        </span>
        <div className="profile-identity-copy">
          <p className="profile-eyebrow">Compte connecté</p>
          <h2>{user?.firstName} {user?.lastName}</h2>
          <p className="profile-email">{user?.email}</p>
        </div>
        <span className="profile-role">
          <ShieldCheck size={15} />{roleLabels[user?.role ?? ""] ?? user?.role}
        </span>
      </section>

      {msg && (
        <p className={`profile-message flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${msgIsError ? "profile-message-error border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300" : "profile-message-success border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"}`} role={msgIsError ? "alert" : "status"}>
          {msgIsError ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}{msg}
        </p>
      )}

      <div className="profile-grid">
        <form
          className="profile-panel"
          onSubmit={async (e) => {
            e.preventDefault();
            setMsg("");
            try {
              await api.patch("/profile", { phone });
              setMsgIsError(false);
              setMsg("Coordonnées mises à jour.");
            } catch (err) {
              setMsgIsError(true);
              setMsg(apiError(err));
            }
          }}
        >
          <div className="profile-panel-header">
            <span className="profile-panel-icon profile-panel-icon-blue"><UserRound size={19} /></span>
            <div className="profile-panel-heading">
              <h2 className="font-semibold">Coordonnées</h2>
              <p className="text-sm text-slate-500">Vos informations de contact.</p>
            </div>
          </div>
          <div className="profile-fields">
            <div className="profile-field">
              <label htmlFor="profile-email" className="flex items-center gap-2"><Mail size={15} />Adresse e-mail</label>
              <input id="profile-email" type="email" value={user?.email ?? ""} disabled />
              <p className="mt-1 text-xs text-slate-500">L’adresse e-mail ne peut pas être modifiée ici.</p>
            </div>
            <div className="profile-field">
              <label htmlFor="profile-phone" className="flex items-center gap-2"><Phone size={15} />Téléphone</label>
              <input id="profile-phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="profile-panel-footer">
            <button className="btn btn-primary"><Save size={16} />Enregistrer</button>
          </div>
        </form>

        <form
          className="profile-panel"
          onSubmit={async (e) => {
            e.preventDefault();
            setMsg("");
            try {
              await api.patch("/profile/password", { currentPassword, newPassword });
              setMsgIsError(false);
              setMsg("Mot de passe modifié.");
              setCurrent("");
              setNew("");
            } catch (err) {
              setMsgIsError(true);
              setMsg(apiError(err));
            }
          }}
        >
          <div className="profile-panel-header">
            <span className="profile-panel-icon profile-panel-icon-amber"><LockKeyhole size={19} /></span>
            <div className="profile-panel-heading">
              <h2 className="font-semibold">Sécurité</h2>
              <p className="text-sm text-slate-500">Choisissez un mot de passe robuste.</p>
            </div>
          </div>
          <div className="profile-fields">
            <div className="profile-field">
              <label htmlFor="current-password">Mot de passe actuel</label>
              <PasswordInput id="current-password" autoComplete="current-password" required value={currentPassword} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div className="profile-field">
              <label htmlFor="new-password">Nouveau mot de passe</label>
              <PasswordInput id="new-password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(e) => setNew(e.target.value)} />
              <p className="mt-1 text-xs text-slate-500">8 caractères minimum.</p>
            </div>
          </div>
          <div className="profile-panel-footer">
            <button className="btn btn-primary"><KeyRound size={16} />Changer le mot de passe</button>
          </div>
        </form>
      </div>
    </div>
  );
}
