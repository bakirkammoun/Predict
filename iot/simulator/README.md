# Simulateur autonome (optionnel)

Le simulateur **officiel** est intégré au backend (`POST /api/v1/simulation/start`) afin d'éviter plusieurs cycles concurrents.

Ce dossier documente un publisher MQTT autonome si vous voulez tester le broker sans l'API :

```bash
cd backend
npx tsx ../iot/simulator/publish.ts
```

Les messages ont toujours `"source": "simulation"`.
