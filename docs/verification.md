# Vérifications

Les tests ciblent exclusivement la base de cette variante, `eventhub_ionic`.

## Commandes

```bat
npm run build
npm test
npm run db:start
npm run test:api
```

Pour les tests navigateur, démarrer `npm start` dans un autre terminal, puis :

```bat
npm run test:e2e
```

Les tests navigateur utilisent Chrome installé localement, avec des comptes et événements temporaires. On peut choisir Edge avec `set "PLAYWRIGHT_CHANNEL=msedge"`. `E2E_BASE_URL` permet de viser le build web servi par Express, mais l'API de test reste volontairement l'instance locale sur le port 3001.

## Couverture

- Tests unitaires : périmètre du JWT, origine API web/native, préfixes trompeurs et normalisation de chemin.
- Tests API : inscription, connexion, rôles, CRUD catégories/événements, propriétaire d'une réservation, modification, annulation, capacité, événement passé, participants, suppressions et concurrence sur la dernière place.
- Tests navigateur : recherche, filtre, erreur réseau et reprise, navigation mobile, inscription et connexion, réservation puis modification/annulation, persistance après rechargement, déconnexion et accès administration.

Les tests créent leurs propres données, puis les nettoient. Les traces navigateur sont désactivées pour ne pas enregistrer les identifiants des comptes de démonstration. Les rapports d'échec restent ignorés par Git.

Les fichiers de verrouillage npm sont conservés. Les overrides ciblés de `tar`, `tmp` et `uuid` remplacent des dépendances indirectes anciennes des outils CLI et de Sequelize. Les versions majeures d'Angular/Ionic/Sequelize sont conservées, et les builds et parcours réels doivent être relancés après toute mise à jour.

La compilation native Android/iOS n'est pas couverte ; voir [mobile.md](mobile.md).

## Résultat de la validation locale du 13 septembre 2026

- Compilation de production Angular et commande Ionic build : validées.
- 3 tests unitaires : réussis.
- 47 réponses API vérifiées, dont la concurrence sur la dernière place.
- 3 parcours Chrome : réussis, y compris édition d’un événement et CRUD d’une catégorie.
- Captures ordinateur 1440 × 1120 et mobile 390 × 844 inspectées.
- Audit npm après corrections ciblées : aucune vulnérabilité signalée dans les trois packages à cette date.
