# Bonus : estimation de probabilité de panne

**État actuel :** aucun modèle entraîné n'est en production. Le champ `heuristicRisk` est un ratio de mesures par rapport aux seuils d'avertissement, borné 0–100. Ce n'est pas une probabilité scientifique.

## Données nécessaires

Mesures horodatées (`vibration`, `temperature`, `current`), états machine, alertes, interventions (dates de panne / réparation), métadonnées (type, âge).

## Préparation

- Fenêtres glissantes (moyenne, RMS, tendance).
- Cible : panne dans les N heures (définie à partir des interventions correctives, pas des seules alertes).
- Valeurs manquantes : interpolation limitée ou exclusion de la fenêtre.
- Séparation temporelle train / test (pas de mélange aléatoire qui fuite le futur).

## Métriques

Précision, rappel, F1, courbe précision-rappel. Les faux positifs coûtent des arrêts inutiles.

## Intégration future

Service Python ou Node isolé, consommé par le backend, jamais appelé depuis le navigateur. Versionner le modèle et refuser d'afficher un taux de précision inventé.
