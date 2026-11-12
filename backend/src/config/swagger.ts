export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "PrédiMaint API",
    version: "1.0.0",
    description:
      "API REST v1 — maintenance prédictive. Les mesures, alertes et indicateurs proviennent de MongoDB. Le mode simulation publie des données synthétiques (source=simulation).",
  },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      ApiError: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/auth/login": {
      post: {
        summary: "Connexion",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                },
              },
              "/auth/register": {
                post: {
                  summary:
                    "Inscription manager / technicien et envoi du code de vérification",
                  security: [],
                },
              },
              "/auth/verify-email": {
                post: {
                  summary:
                    "Vérification de l’adresse e-mail et création du compte",
                  security: [],
                },
              },
            },
          },
        },
      },
    },
    "/auth/bootstrap": {
      post: {
        summary: "Création du premier administrateur (si aucun utilisateur)",
        security: [],
      },
    },
    "/auth/me": { get: { summary: "Profil courant" } },
    "/auth/logout": {
      post: {
        summary: "Déconnexion : incrémente tokenVersion et invalide le JWT",
      },
    },
    "/measurements": {
      get: { summary: "Mesures paginées (machines accessibles)" },
    },
    "/dashboard/summary": {
      get: { summary: "Indicateurs du tableau de bord (données persistées)" },
    },
    "/dashboard/events": {
      get: { summary: "Historique récent des changements d'état" },
    },
    "/machines": {
      get: { summary: "Liste paginée des machines (filtrée par rôle)" },
      post: { summary: "Créer une machine et son appareil IoT (admin)" },
    },
    "/machines/{id}": {
      get: { summary: "Détail machine" },
      patch: { summary: "Modifier une machine" },
    },
    "/machines/{id}/deactivate": {
      post: { summary: "Désactiver sans supprimer l'historique" },
    },
    "/machines/{id}/measurements": {
      get: { summary: "Historique des mesures (paginé)" },
    },
    "/machines/{id}/alerts": { get: { summary: "Alertes d'une machine" } },
    "/machines/{id}/interventions": {
      get: { summary: "Interventions d'une machine" },
    },
    "/alerts": { get: { summary: "Liste des alertes" } },
    "/alerts/{id}": { get: { summary: "Détail d'une alerte" } },
    "/alerts/{id}/status": {
      patch: { summary: "Changer le statut d'une alerte" },
    },
    "/interventions": {
      get: { summary: "Liste des interventions" },
      post: { summary: "Créer une intervention (responsable / admin)" },
    },
    "/interventions/{id}": {
      get: { summary: "Détail" },
      patch: { summary: "Mettre à jour (statut, compte rendu)" },
    },
    "/users": {
      get: { summary: "Utilisateurs" },
      post: { summary: "Créer un utilisateur (admin)" },
    },
    "/users/pending-approval": {
      get: { summary: "Demandes de compte en attente (admin)" },
    },
    "/users/{id}/approve": {
      post: { summary: "Approuver et activer un compte en attente (admin)" },
    },
    "/users/{id}": { patch: { summary: "Modifier un utilisateur (admin)" } },
    "/devices": { get: { summary: "Liste des appareils IoT (admin)" } },
    "/devices/{id}/revoke": {
      post: { summary: "Révoquer un appareil (plus de télémétrie)" },
    },
    "/devices/{id}/rotate-secret": {
      post: { summary: "Rotation du secret appareil (admin)" },
    },
    "/notifications": {
      get: { summary: "Notifications de l'utilisateur connecté" },
    },
    "/profile": {
      get: { summary: "Profil" },
      patch: { summary: "Mettre à jour le profil" },
    },
    "/settings": {
      get: { summary: "Paramètres système" },
      patch: { summary: "Mettre à jour (admin)" },
    },
    "/reports": { get: { summary: "Rapport par machine" } },
    "/simulation": { get: { summary: "État du simulateur" } },
    "/simulation/start": {
      post: { summary: "Démarrer le simulateur (un seul cycle)" },
    },
    "/simulation/stop": { post: { summary: "Arrêter le simulateur" } },
    "/simulation/interval": { post: { summary: "Fréquence d'émission" } },
    "/simulation/scenario": {
      post: {
        summary: "Injecter un scénario (normal, warning, critical, offline)",
      },
    },
    "/audit": { get: { summary: "Journaux d'activité (admin)" } },
  },
};
