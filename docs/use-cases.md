# Cas d'utilisation

```mermaid
flowchart LR
  Admin --> Users[Gérer utilisateurs]
  Admin --> Machines[Parc machines]
  Admin --> Settings[Seuils et système]
  Admin --> Audit[Journaux]
  Manager --> Supervise[Superviser le parc]
  Manager --> Plan[Planifier interventions]
  Tech --> See[Machines assignées]
  Tech --> Alerts[Alertes]
  Tech --> Report[Compte rendu mobile]
```

| Acteur | Objectifs |
| --- | --- |
| Administrateur | Comptes, machines, appareils, seuils, audit, bootstrap initial |
| Responsable | Supervision, interventions, rapports, simulation |
| Technicien | Machines accessibles, alertes, interventions assignées, compte rendu |

Les autorisations sont appliquées **sur le serveur** (`authenticate`, `authorize`, `assertMachineAccess`).
