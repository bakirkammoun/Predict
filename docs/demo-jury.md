# Procédure de démonstration (jury)

1. `docker compose up -d` (MongoDB + Mosquitto).
2. Copier `.env.example` vers `.env`, définir `JWT_SECRET` (le mot de passe de démonstration par défaut est `12345678`).
3. `cd backend && npm install && npm run seed && npm run dev`
4. `cd frontend && npm install && npm run dev`
5. Connexion web :
   - Bakir Kammoun (admin@gmail.com)
   - Ayoub Bahroun (manager@gmail.com)
   - Nacir Mahfoudhi (tech@gmail.com)
   Mot de passe = `12345678` par défaut (données **fictives**, développement/démonstration uniquement).
6. Page **Simulation** : Démarrer, puis scénario `warning` / `critical` sur une machine.
7. Vérifier le tableau de bord, les alertes, une intervention, le calendrier.
8. Mobile : `flutter run` (compte technicien). Démarrer / terminer une intervention.
9. Rappeler : les capteurs physiques ne sont pas branchés ; `source=simulation`.

OpenAPI : http://localhost:4000/api/docs
