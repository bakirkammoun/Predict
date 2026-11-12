import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="p-10 text-center">
      <h1 className="text-3xl font-bold">Page introuvable</h1>
      <p className="mt-2 text-slate-500">La ressource demandée n'existe pas.</p>
      <Link className="btn btn-primary mt-6 inline-flex" to="/">
        Retour au tableau de bord
      </Link>
    </div>
  );
}
