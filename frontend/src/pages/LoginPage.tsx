import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Activity, Check, Factory, ShieldCheck } from "lucide-react";
import { useAuth } from "../lib/auth";
import { apiError } from "../lib/api";
import { PasswordInput } from "../components/PasswordInput";
import { ListSelect } from "../components/ListSelect";

const schema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "8 caractères minimum"),
});

const registrationSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom obligatoire"),
  lastName: z.string().trim().min(1, "Nom obligatoire"),
  email: z.string().email("Email invalide"),
  password: z.string().min(10, "10 caractères minimum"),
  role: z.enum(["maintenance_manager", "technician"]),
});

const verificationSchema = z.object({
  code: z
    .string()
    .regex(/^\d{6}$/, "Saisissez les 6 chiffres reçus par e-mail"),
});

export function LoginPage() {
  const { login, register: registerAccount, verifyEmail } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [screen, setScreen] = useState<
    "login" | "register" | "verify" | "pending"
  >("login");
  const [verificationEmail, setVerificationEmail] = useState("");
  const loginForm = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });
  const registrationForm = useForm<z.infer<typeof registrationSchema>>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { role: "technician" },
  });
  const verificationForm = useForm<z.infer<typeof verificationSchema>>({
    resolver: zodResolver(verificationSchema),
  });
  const {
    register: registerLogin,
    formState: { errors: loginErrors, isSubmitting: loginSubmitting },
  } = loginForm;

  return (
    <div className="login-page">
      <div className="login-layout">
        <section className="login-form-side">
          <div className="login-form-wrap">
            <div className="login-brand">
              <span className="login-brand-icon">
                <Factory size={21} />
              </span>
              <span>PrédiMaint</span>
            </div>
            <h1 className="login-title">
              {screen === "register"
                ? "Créer un compte"
                : screen === "verify"
                  ? "Vérifiez votre e-mail"
                  : screen === "pending"
                    ? "Compte en attente"
                    : "Bon retour !"}
            </h1>
            <p className="login-tagline">Anticipez la panne, pas la perte.</p>

            <div className="login-form-intro">
              <p className="font-semibold text-slate-900">
                {screen === "register"
                  ? "Inscription"
                  : screen === "verify"
                    ? "Confirmation de l’adresse"
                    : screen === "pending"
                      ? "Votre adresse e-mail est confirmée. L’administrateur a reçu votre demande et doit approuver votre compte."
                      : "Connexion"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {screen === "register"
                  ? "Choisissez votre rôle. Un code sera envoyé à votre adresse."
                  : screen === "verify"
                    ? `Saisissez le code à 6 chiffres envoyé à ${verificationEmail}.`
                    : screen === "pending"
                      ? "Vous serez informé lorsque l’administrateur aura approuvé votre compte."
                      : "Accédez à votre espace de maintenance."}
              </p>
            </div>

            {screen === "login" && (
              <form
                className="login-form"
                onSubmit={loginForm.handleSubmit(async (v) => {
                  setError("");
                  try {
                    await login(v.email, v.password);
                    navigate("/");
                  } catch (e) {
                    setError(apiError(e));
                  }
                })}
              >
                <div>
                  <label htmlFor="email">Adresse e-mail</label>
                  <input
                    className="login-input"
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="nom@entreprise.com"
                    {...registerLogin("email")}
                    aria-invalid={Boolean(loginErrors.email)}
                  />
                  {loginErrors.email && (
                    <p className="mt-1 text-sm text-red-600">
                      {loginErrors.email.message}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="password">Mot de passe</label>
                  <PasswordInput
                    className="login-input"
                    id="password"
                    autoComplete="current-password"
                    placeholder="Votre mot de passe"
                    {...registerLogin("password")}
                    aria-invalid={Boolean(loginErrors.password)}
                    required
                  />
                  {loginErrors.password && (
                    <p className="mt-1 text-sm text-red-600">
                      {loginErrors.password.message}
                    </p>
                  )}
                </div>
                {error && (
                  <p
                    className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"
                    role="alert"
                  >
                    {error}
                  </p>
                )}
                <button
                  className="btn btn-primary login-submit w-full"
                  disabled={loginSubmitting}
                >
                  {loginSubmitting ? "Connexion…" : "Se connecter"}
                </button>
              </form>
            )}

            {screen === "register" && (
              <form
                className="login-form"
                onSubmit={registrationForm.handleSubmit(async (v) => {
                  setError("");
                  try {
                    await registerAccount(v);
                    setVerificationEmail(v.email);
                    setScreen("verify");
                  } catch (e) {
                    setError(apiError(e));
                  }
                })}
              >
                <div>
                  <label htmlFor="firstName">Prénom</label>
                  <input
                    className="login-input"
                    id="firstName"
                    autoComplete="given-name"
                    {...registrationForm.register("firstName")}
                  />
                  {registrationForm.formState.errors.firstName && (
                    <p className="mt-1 text-sm text-red-600">
                      {registrationForm.formState.errors.firstName.message}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="lastName">Nom</label>
                  <input
                    className="login-input"
                    id="lastName"
                    autoComplete="family-name"
                    {...registrationForm.register("lastName")}
                  />
                  {registrationForm.formState.errors.lastName && (
                    <p className="mt-1 text-sm text-red-600">
                      {registrationForm.formState.errors.lastName.message}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="registerEmail">Adresse e-mail</label>
                  <input
                    className="login-input"
                    id="registerEmail"
                    type="email"
                    autoComplete="email"
                    placeholder="nom@entreprise.com"
                    {...registrationForm.register("email")}
                  />
                  {registrationForm.formState.errors.email && (
                    <p className="mt-1 text-sm text-red-600">
                      {registrationForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="registerPassword">
                    Mot de passe (10 caractères minimum)
                  </label>
                  <PasswordInput
                    className="login-input"
                    id="registerPassword"
                    autoComplete="new-password"
                    {...registrationForm.register("password")}
                    aria-invalid={Boolean(registrationForm.formState.errors.password)}
                    required
                    minLength={10}
                  />
                  {registrationForm.formState.errors.password && (
                    <p className="mt-1 text-sm text-red-600">
                      {registrationForm.formState.errors.password.message}
                    </p>
                  )}
                </div>
                <div>
                  <label id="role-label">Type de compte</label>
                  <ListSelect
                    ariaLabel="Type de compte"
                    ariaLabelledBy="role-label"
                    value={registrationForm.watch("role")}
                    onChange={(value) => registrationForm.setValue("role", value as "technician" | "maintenance_manager")}
                    options={[
                      { value: "technician", label: "Technicien" },
                      { value: "maintenance_manager", label: "Manager maintenance" },
                    ]}
                  />
                </div>
                {error && (
                  <p
                    className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"
                    role="alert"
                  >
                    {error}
                  </p>
                )}
                <button
                  className="btn btn-primary login-submit w-full"
                  disabled={registrationForm.formState.isSubmitting}
                >
                  {registrationForm.formState.isSubmitting
                    ? "Envoi du code…"
                    : "Créer mon compte"}
                </button>
              </form>
            )}

            {screen === "verify" && (
              <form
                className="login-form"
                onSubmit={verificationForm.handleSubmit(async ({ code }) => {
                  setError("");
                  try {
                    await verifyEmail(verificationEmail, code);
                    setScreen("pending");
                  } catch (e) {
                    setError(apiError(e));
                  }
                })}
              >
                <div>
                  <label htmlFor="code">Code de vérification</label>
                  <input
                    className="login-input"
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    {...verificationForm.register("code")}
                  />
                  {verificationForm.formState.errors.code && (
                    <p className="mt-1 text-sm text-red-600">
                      {verificationForm.formState.errors.code.message}
                    </p>
                  )}
                </div>
                {error && (
                  <p
                    className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"
                    role="alert"
                  >
                    {error}
                  </p>
                )}
                <button
                  className="btn btn-primary login-submit w-full"
                  disabled={verificationForm.formState.isSubmitting}
                >
                  {verificationForm.formState.isSubmitting
                    ? "Vérification…"
                    : "Vérifier et continuer"}
                </button>
              </form>
            )}

            {screen !== "verify" && screen !== "pending" && (
              <p className="login-help">
                {screen === "login"
                  ? "Pas encore de compte ? "
                  : "Vous avez déjà un compte ? "}
                <button
                  className="font-semibold text-brand hover:underline"
                  onClick={() => {
                    setError("");
                    setScreen(screen === "login" ? "register" : "login");
                  }}
                >
                  {screen === "login" ? "Créer un compte" : "Se connecter"}
                </button>
              </p>
            )}
            {screen === "verify" && (
              <p className="login-help">
                <button
                  className="font-semibold text-brand hover:underline"
                  onClick={() => {
                    setError("");
                    setScreen("register");
                  }}
                >
                  Retour à l’inscription
                </button>
              </p>
            )}

            {screen === "pending" && (
              <div className="space-y-4">
                <p
                  className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800"
                  role="status"
                >
                  Votre compte n’est pas encore actif. Vous pourrez vous
                  connecter après approbation par l’administrateur.
                </p>
                <button
                  className="btn btn-primary login-submit w-full"
                  onClick={() => setScreen("login")}
                >
                  Retour à la connexion
                </button>
              </div>
            )}
          </div>
          <p className="login-copyright">
            © {new Date().getFullYear()} PrédiMaint · Maintenance intelligente
          </p>
        </section>

        <aside className="login-promo">
          <div className="login-promo-content">
            <span className="login-promo-eyebrow">
              <Activity size={15} /> SUPERVISION INTELLIGENTE
            </span>
            <h2>Gardez vos équipements en pleine activité.</h2>
            <p className="login-promo-description">
              Une vue claire sur votre parc, les alertes et les interventions
              pour agir au bon moment.
            </p>

            <ul className="login-features">
              <li>
                <span>
                  <Check size={15} />
                </span>{" "}
                Suivez l’état de vos machines en temps réel
              </li>
              <li>
                <span>
                  <Check size={15} />
                </span>{" "}
                Repérez rapidement les anomalies détectées
              </li>
              <li>
                <span>
                  <Check size={15} />
                </span>{" "}
                Organisez les interventions de maintenance
              </li>
            </ul>

            <div className="login-promo-card">
              <div className="login-promo-card-icon">
                <ShieldCheck size={23} />
              </div>
              <div>
                <p className="font-semibold">Une maintenance mieux maîtrisée</p>
                <p className="mt-1 text-sm leading-relaxed text-white/80">
                  Centralisez les informations essentielles et prenez vos
                  décisions avec une vue d’ensemble.
                </p>
              </div>
            </div>
          </div>
          <div className="login-decoration login-decoration-one" />
          <div className="login-decoration login-decoration-two" />
        </aside>
      </div>
    </div>
  );
}
