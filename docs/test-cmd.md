# Premier test avec CMD

Ce parcours concerne la copie déjà installée sur ce PC. Il ne faut pas réinstaller les dépendances ni recréer la base pour la démarrer.

## 1. Vérifier le dossier et les outils

Ouvrir **Invite de commandes (CMD)**, puis saisir une ligne à la fois :

```bat
cd /d C:\IONIC\EventHub-Reservation-Platform-Ionic
node --version
npm --version
```

L'invite doit afficher le dossier du projet. Les deux autres commandes affichent les versions de Node.js et npm. Le `/d` permet aussi de changer de lecteur si CMD était ouvert ailleurs.

## 2. Démarrer l'application

Si une instance EventHub Ionic est déjà ouverte dans un autre terminal, l'arrêter avec Ctrl+C avant d'en lancer une seconde. Si CMD demande de terminer le programme de commandes, confirmer avec la lettre proposée pour Oui.

```bat
npm start
```

Attendre les messages de connexion PostgreSQL réussie, de serveur API démarré sur le port 3001 et l'adresse `http://localhost:8100/`. Garder ce terminal ouvert. Si le port 8100 ou 3001 est déjà occupé, ne pas accepter automatiquement un autre port : vérifier d'abord si l'application fonctionne déjà.

## 3. Vérifier dans le navigateur

Ouvrir http://localhost:8100 : l'agenda doit afficher les événements de démonstration. Essayer le filtre **Disponibles**, puis ouvrir le détail d'un événement.

Pour tester une réservation, ouvrir `LOCAL-ACCESS.md` sur ce PC et utiliser le compte participant. Ne pas copier ses mots de passe dans une conversation ou sur GitHub. Réserver une place, aller dans **Mes réservations**, puis modifier ou annuler cette réservation.

## 4. Vérifier l'API depuis un second CMD

Laisser le premier terminal ouvert et saisir dans un deuxième :

```bat
cd /d C:\IONIC\EventHub-Reservation-Platform-Ionic
curl.exe http://localhost:3001/api/health
```

La réponse JSON doit contenir le message « API opérationnelle ».

Pour lancer ensuite les vérifications métier automatiques :

```bat
npm run test:api
```

Le résultat attendu est la validation de 47 réponses HTTP, suivie du nettoyage des données temporaires du test.

## 5. Arrêter proprement

Dans le premier terminal : **Ctrl+C**, puis confirmer si CMD le demande. Une fois l'invite revenue :

```bat
npm run db:stop
```

La base dédiée est arrêtée et les données restent conservées. Le prochain `npm start` la redémarrera.

## CMD et PowerShell

Dans CMD, `npm` fonctionne directement ; `npm.cmd` fonctionne aussi. Les scripts du projet ne changent pas. Les différences concernent surtout le changement de dossier (`cd /d`) et les variables d'environnement (`set "NOM=valeur"`). Les guides de ce dépôt utilisent désormais ces formes CMD.
