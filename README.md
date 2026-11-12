# PrédiMaint

**Anticipez la panne, pas la perte.**

Système universitaire de maintenance prédictive intelligente : surveillance d'un parc de machines (vibration, température, courant), détection d'anomalies par seuils, alertes, interventions, dashboard web et application mobile technicien.

## Problématique

Les pannes imprévues arrêtent la production. La maintenance corrective agit trop tard ; la préventive remplace trop tôt. PrédiMaint surveille l'état des machines pour intervenir **avant** la panne, sans prétendre à une prédiction ML tant qu'aucun modèle n'est entraîné.

## Fonctionnalités

- Authentification JWT, inscription manager / technicien avec code de vérification par e-mail, et rôles (admin, responsable, technicien)
- Parc machines, mesures paginées, alertes dédupliquées, interventions avec transitions
- MQTT (Mosquitto) + simulateur intégré (un seul cycle de vie)
- Temps réel Socket.IO (authentifié, filtré par machines accessibles)
- Dashboard calculé sur les données persistées (période 24 h / 7 j / 30 j)
- Gestion des appareils IoT (révocation)
- App Flutter technicien
- Firmware ESP32 (mode simulation ou capteurs réels, à calibrer)
- OpenAPI, tests unitaires, Docker Compose

## Architecture

Capteurs / simulateur → ESP32 (optionnel) → MQTT → Backend Express → MongoDB → API + Socket.IO → React et Flutter.

Détails : [docs/architecture.md](docs/architecture.md).

## Technologies

React + TypeScript + Vite + Tailwind · Node.js + Express · MongoDB + Mongoose · MQTT.js · Socket.IO · Flutter · Mosquitto · Docker Compose.

## Prérequis

- Node.js 20+
- Compte MongoDB Atlas (recommandé) **ou** MongoDB local via Docker
- Docker pour Mosquitto (et MongoDB local si Atlas n'est pas utilisé)
- Flutter SDK pour l'application mobile
- PlatformIO / Arduino IDE pour l'ESP32
- Matériel optionnel : ESP32, DS18B20, ACS712, accéléromètre analogique

## Installation

```bash
copy .env.example .env
```

Dans `.env` uniquement (jamais dans Git) : coller `MONGODB_URI` Atlas, un `JWT_SECRET` long, les paramètres SMTP `MAIL_*` pour activer l'inscription, et éventuellement `MQTT_USERNAME` / `MQTT_PASSWORD`.

Si les identifiants Atlas ont déjà été collés dans un chat ou un dépôt, **les faire tourner** dans la console Atlas (utilisateur + mot de passe).

```bash
docker compose up -d
cd backend && npm install && npm run seed && npm run dev
```

`docker compose` démarre Mosquitto (et un MongoDB local). Si `MONGODB_URI` pointe vers Atlas, le backend n'utilise pas le Mongo du compose.

Dans un second terminal :

```bash
cd frontend && npm install && npm run dev
```

- Web : http://localhost:5173
- API : http://localhost:4000
- OpenAPI : http://localhost:4000/api/docs

### Variables d'environnement

Voir `.env.example`. Ne commitez jamais de secrets réels. `JWT_SECRET` doit être long et aléatoire hors démonstration. Aucun mot de passe administrateur n'est codé en dur : premier admin via `POST /api/v1/auth/bootstrap` ou `npm run seed` (développement uniquement, n'écrase pas les utilisateurs existants).

L'inscription est disponible sur le web et le mobile pour les rôles **Manager maintenance** et **Technicien**. Après vérification du code à 6 chiffres reçu par l'utilisateur (valable 10 minutes), son compte reste désactivé jusqu'à l'approbation d'un administrateur. Une demande est envoyée à `MAIL_ADMIN_EMAIL` (par défaut `MAIL_USER`); l'administrateur se connecte puis approuve le compte dans **Utilisateurs**. Configurez les paramètres SMTP `MAIL_*` dans `.env`; sans configuration SMTP, les inscriptions sont désactivées côté API.

### MongoDB Atlas

Réseau Atlas : autoriser l'IP du PC (ou `0.0.0.0/0` uniquement en démo isolée). Base : `maintenance_db`. L'URI complète reste dans `.env`.

### Mosquitto

`docker compose up -d` expose `:1883`. ACL d'exemple : `infrastructure/mosquitto/acl.example`. Le compose de développement autorise l'anonyme.

### Simulateur (tests uniquement)

Page **Simulation** (admin / responsable). Scénarios : `normal` | `warning` | `critical` | `offline` | `sensor_error`.  
Badge interface : **SIMULATION**. Désactivé si `NODE_ENV=production` sauf `SIMULATION_ENABLED=true`.

### ESP32 réel

Câblage : [docs/esp32-cablage.md](docs/esp32-cablage.md). Topics : [docs/mqtt.md](docs/mqtt.md).

1. Créer l'appareil dans **Appareils IoT** (`hardwareId` = `DEVICE_ID`).
2. `copy iot\firmware\secrets.example.h iot\firmware\secrets.h` puis Wi-Fi / MQTT.
3. `SIMULATION_MODE 0` seulement avec capteurs câblés.
4. Badge mesures : **HARDWARE_REAL** (`source=hardware`).

Aucun test physique n'a été exécuté ici : le firmware est compilable, pas validé sur banc.

### Flutter

```bash
cd mobile
flutter create . --project-name predimaint_mobile
flutter pub get
flutter run --dart-define=API_BASE=http://10.0.2.2:4000/api/v1
```

Sur un téléphone physique, remplacer `10.0.2.2` par l'IP LAN du PC. Compte : `tech@gmail.com`.

Les notifications push d'un fournisseur cloud **ne sont pas intégrées** ; l'app lit les notifications via l'API.

### Tests

```bash
cd backend && npm test
cd frontend && npm test
```

À la racine : `npm test` (si les dépendances des deux projets sont installées).

## Comptes de démonstration

Créés par `npm run seed` si la base est vide :

| Email | Rôle |
| --- | --- |
| admin@gmail.com | Bakir Kammoun — Administrateur |
| manager@gmail.com | Ayoub Bahroun — Responsable maintenance |
| tech@gmail.com | Nacir Mahfoudhi — Technicien |

Mot de passe par défaut : `12345678` (variable `SEED_PASSWORD`). Données **fictives**, réservé au développement/démonstration. Ces noms sont appliqués
uniquement lors de la création des comptes sur une base sans utilisateurs ;
le seed ne modifie pas les comptes déjà présents.
Le seed prépare également les appareils `ESP32-001` à `ESP32-004` et leurs machines associées ; `ESP32-004` est lié à `MACHINE-004`. Sur une base existante,
créer ou vérifier cette association dans **Parc machines** : le seed est ignoré dès que des utilisateurs existent.
Pour mettre à jour les adresses, noms et mots de passe des comptes de démonstration
dans une base existante, exécuter `cd backend` puis `npm run update-demo-users`.
Cette commande règle leur mot de passe sur la valeur `SEED_PASSWORD`.

## Dépannage

| Symptôme | Piste |
| --- | --- |
| Seed ignoré | Des utilisateurs existent déjà (volontaire). |
| Simulateur sans mesures | Broker MQTT arrêté, ou machine inactive. |
| 401 Socket.IO | Jeton absent (connexion web requise). |
| Flutter ne joint pas l'API | Mauvaise `API_BASE`, backend non lancé, CORS/IP. |
| Graphiques vides | Aucune mesure persistée : démarrer la simulation. |

## Limites connues

- Pas de modèle de panne entraîné (`heuristicRisk` = heuristique).
- Mosquitto local sans TLS ni ACL (développement).
- Firmware : calibrage capteurs à faire sur banc réel.
- Notifications push non branchées à FCM / APNs.
- Conservation des mesures selon `MEASUREMENT_RETENTION_DAYS`.

## Démonstration jury

Voir [docs/demo-jury.md](docs/demo-jury.md). Captures d'écran : à ajouter dans `docs/screenshots/` après la soutenance de répétition.

## Documentation

- [Architecture](docs/architecture.md)
- [Cas d'utilisation](docs/use-cases.md)
- [Modèle de données](docs/data-model.md)
- [Séquence mesure / alerte](docs/sequence-mesure-alerte.md)
- [MQTT](docs/mqtt.md)
- [ML bonus](docs/ml-bonus.md)
