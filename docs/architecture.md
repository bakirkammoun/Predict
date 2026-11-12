# Architecture PrédiMaint

Slogan : **PrédiMaint — Anticipez la panne, pas la perte.**

## Chaîne de données

```
Capteurs / simulateur
        ↓
ESP32 (Wi-Fi)  ou  simulateur backend
        ↓ MQTT
Broker Mosquitto
        ↓
Backend Node.js (validation, détection, persistance)
        ↓
MongoDB (source de vérité)
        ↓
API REST + Socket.IO
        ↓
Dashboard React  |  Application Flutter
```

Le frontend et le mobile n'accèdent jamais à MongoDB ni au broker MQTT.

## Modules backend

| Module | Rôle |
| --- | --- |
| Acquisition MQTT | Abonnement `predimaint/devices/+/telemetry` et `…/status` |
| Validation | Schéma Zod, rejet des messages mal formés |
| Ingestion | Association appareil ↔ machine, déduplication, horodatage |
| Détection | Seuils, confirmation, hystérésis (pas un modèle ML) |
| Alertes | Empreinte + cooldown, pas une alerte par message |
| API / Socket.IO | Présentation, autorisations, temps réel |
| Simulateur | Un seul cycle de vie, source=`simulation` |

## Disponibilité

Formule utilisée :

`A = (durée où healthStatus ∈ {normal, warning}) / durée de la période`, moyenne sur les machines accessibles.

Les états `critical` et `offline` réduisent la disponibilité. Calcul à partir de `HealthStateLog`.

## Prédiction de panne (bonus, non entraîné)

Aucun modèle ML n'est déployé. L'indicateur `heuristicRisk` (0–100) est une heuristique de seuils, explicitement identifiée comme telle. Voir `docs/ml-bonus.md`.
