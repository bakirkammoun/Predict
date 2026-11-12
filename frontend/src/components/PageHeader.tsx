import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  section,
  actions,
}: {
  title: string;
  description?: string;
  section: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header-copy">
        <p className="page-header-section">{section}</p>
        <h1>{title}</h1>
        {description && <p className="page-header-description">{description}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}
