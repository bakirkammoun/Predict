# PrédiMaint — application mobile Flutter

L'application reprend le logo violet PrédiMaint et le sous-titre « Maintenance
intelligente » du dashboard web. Ses boutons principaux noirs en forme de pilule
et ses contrôles secondaires discrets s'inspirent de la référence iPhone, tandis
que les écrans et couleurs de marque PrédiMaint restent inchangés. L'icône
d'application et les écrans de démarrage Android conservent leurs ressources dédiées.

L'interface mobile reprend la maquette de référence : fond clair, cartes blanches
arrondies, panneau santé bleu marine avec courbe, quatre indicateurs compacts,
planning mensuel et bouton central « + » dans la navigation. Le détail équipement
propose les onglets Aperçu, Analyses, Maintenance et Historique. Les couleurs d'alerte
restent distinctes pour conserver leur signification.

La barre inférieure affiche Accueil, Équipements, Maintenance et Alertes ; le bouton
central ouvre les destinations secondaires autorisées selon le rôle.

Écrans mobiles disponibles : connexion, tableau de bord, machines et mesures, alertes,
interventions et compte rendu, notifications, profil modifiable et simulation des
mesures (administrateur et responsable maintenance). Le changement du mot de passe
déconnecte ensuite la session pour appliquer la révocation des jetons. Les listes et statistiques
proviennent de l'API ; les écrans indiquent explicitement les états vides.
L'administrateur dispose aussi des écrans de gestion des utilisateurs et appareils IoT,
des paramètres système et des seuils par machine, ainsi que du journal d'audit. Les rôles maintenance et technicien
voient uniquement les sections de navigation qui leur sont destinées.

Le jeton JWT est stocké avec `flutter_secure_storage`.

```bash
flutter create . --project-name predimaint_mobile
flutter pub get
flutter run --dart-define=API_BASE=http://192.168.43.253:4000/api/v1
```

Cette adresse convient au téléphone physique connecté au même Wi-Fi que le PC.
Pour l'émulateur Android, utiliser `http://10.0.2.2:4000/api/v1`.

Pour lancer sur un téléphone Android connecté en USB, vérifier d'abord sa détection
avec `flutter devices`, puis utiliser son identifiant :

```bash
flutter run -d DEVICE_ID --dart-define=API_BASE=http://192.168.43.253:4000/api/v1
```

Remplacer `DEVICE_ID` par l'identifiant affiché par `flutter devices`. Si l'adresse
du PC change, remplacer `192.168.43.253` par sa nouvelle adresse IPv4. Le téléphone
et le PC doivent être sur le même réseau.
Le serveur API doit écouter
sur le réseau local et son port doit être autorisé dans le pare-feu Windows. Le
trafic HTTP non chiffré est autorisé uniquement pour les builds Android debug ;
configurer HTTPS pour un build de production.

Vérifications locales :

```bash
flutter analyze
flutter test
```

Les notifications listées viennent de `GET /api/v1/notifications`. Aucun fournisseur push n'est configuré.
