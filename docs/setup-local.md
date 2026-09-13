# Configuration locale et base dédiée

La version Ionic utilise son propre backend sur le port **3001** et une base nommée **eventhub_ionic**. L'application Ionic est accessible sur **http://localhost:8100**. Le projet EventHub d'origine conserve ses fichiers, sa base et son port 3000.

## Installation autonome sous Windows

Prérequis : Node.js 24.15 ou supérieur dans la branche 24, npm et les binaires PostgreSQL installés. Le script détecte les installations dans `C:\Program Files\PostgreSQL`. Si nécessaire, renseigner `POSTGRES_BIN` avec le dossier contenant `initdb` et `pg_ctl`.

Les commandes de ce guide sont prévues pour **CMD**. Depuis la racine du nouveau projet :

```bat
npm run install:all
npm run setup:local -- --isolated-postgres
npm start
```

Le setup initialise une instance PostgreSQL privée dans `.local-postgres/data`, accessible uniquement sur **127.0.0.1:5433**. Il génère un mot de passe de base, un secret JWT et deux comptes de démonstration indépendants. Le service PostgreSQL global n'est pas modifié. Le port 5433 doit être disponible : le script n'arrête aucun autre processus.

Les identifiants du compte administrateur et du participant se trouvent dans **LOCAL-ACCESS.md**. Les accès techniques restent dans **Backend/.env**. Ces deux fichiers et tout le dossier `.local-postgres` sont ignorés par Git. Ne pas les publier.

`npm start` redémarre automatiquement cette instance locale si nécessaire. Arrêter l'application avec Ctrl+C conserve PostgreSQL disponible. Pour arrêter également la base :

```bat
npm run db:stop
```

Pour ne redémarrer que la base :

```bat
npm run db:start
```

Le setup est réexécutable : les tables et données de démonstration manquantes sont ajoutées sans suppression des données existantes. Il conserve les secrets déjà générés. Aucun service Windows ni tâche de démarrage automatique n'est installé.

## Utiliser un serveur PostgreSQL existant

Si vous préférez utiliser votre serveur PostgreSQL habituel, copier `Backend/.env.example` vers `Backend/.env`, renseigner les accès et garder `DB_NAME=eventhub_ionic`. Le rôle doit pouvoir créer cette base, ou un administrateur doit la créer avec ce rôle comme propriétaire. Puis lancer :

```bat
npm run setup:local
```

L'option `--from-env CHEMIN` permet de lire les paramètres PostgreSQL d'un autre fichier pour générer le nouveau `.env` lorsqu'il n'existe pas encore. Seuls les accès de connexion sont réutilisés ; le nom de base, le port API, les comptes démo et les secrets de cette version restent indépendants. Si le rôle n'a pas `CREATEDB`, utiliser l'installation autonome ci-dessus. Le setup local refuse toute base autre que `eventhub_ionic` et toute `DATABASE_URL` pour éviter de viser une instance différente par inadvertance.

## Déplacer ce projet sur le même ordinateur

1. Arrêter l'application puis lancer `npm run db:stop` dans son ancien dossier.
2. Copier le projet entier, y compris `Backend/.env`, `LOCAL-ACCESS.md` et `.local-postgres`, vers le nouveau dossier.
3. Lancer `npm start` depuis le nouveau dossier.

Le chemin des données est calculé à partir du dossier courant du projet. Aucun chemin absolu vers le projet n'est enregistré dans la configuration générée de PostgreSQL. La même version majeure de PostgreSQL doit rester installée ; le script lit `.local-postgres/data/PG_VERSION` pour sélectionner ses binaires. Ne jamais démarrer deux copies de cette instance simultanément sur le même port. Pour un autre ordinateur, préférer un nouveau setup puis une sauvegarde/restauration PostgreSQL adaptée.

## Vérification API

```bat
npm run db:start
npm run test:api
```

Le script démarre temporairement Express sur un port libre et utilise de vraies requêtes HTTP avec la base `eventhub_ionic`. Il vérifie l'inscription, les connexions, les rôles utilisateur/admin, les catégories, les événements, les réservations, leur modification/annulation et les restrictions de propriété. Deux réservations simultanées sur la dernière place doivent produire exactement un succès. Les comptes, catégories, événements et réservations créés par le test sont nettoyés dans un bloc `finally`, sans supprimer les données de démonstration ni celles saisies par l'utilisateur.

## Build servi par Express

```bat
npm run build
npm run db:start
set "NODE_ENV=production"
npm --prefix Backend start
```

Express sert `Frontend/www` et l'API sous la même origine sur **http://localhost:3001**. La variable `NODE_ENV` du terminal a priorité sur le fichier `.env`. Arrêter d’abord le serveur avec Ctrl+C. Pour revenir au développement dans le même terminal CMD :

```bat
set "NODE_ENV="
npm start
```
