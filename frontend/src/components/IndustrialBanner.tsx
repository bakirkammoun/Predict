import { Activity, RadioTower } from "lucide-react";

export function IndustrialBanner() {
  return (
    <section className="industrial-banner" aria-label="Supervision industrielle">
      <img
        className="industrial-banner-image"
        src="/images/factory-automation.jpg"
        alt="Robot industriel sur une ligne de production automatisée"
        fetchPriority="high"
      />
      <div className="industrial-banner-shade" />
      <div className="industrial-banner-content">
        <span className="industrial-banner-label"><RadioTower size={15} /> SUPERVISION INDUSTRIELLE</span>
        <h2>Une vision claire de vos équipements.</h2>
        <p>Les données de votre parc, les alertes et les interventions réunies au même endroit.</p>
        <span className="industrial-banner-status"><Activity size={15} /> Données issues de votre parc</span>
      </div>
    </section>
  );
}
