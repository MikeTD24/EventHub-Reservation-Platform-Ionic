# De la démo du cours à EventHub Ionic

Cette variante reprend les conventions de la [démo Ionic du formateur](https://github.com/zachary-BSTORM/Demo-ionic-TF26L028) et les fonctionnalités du [projet EventHub original](https://github.com/MikeTD24/EventHub-Reservation-Platform).

| Notion vue au cours                        | Application dans EventHub                                          |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `ion-app`, `ion-menu`, `ion-router-outlet` | Structure de l'application et navigation adaptative                |
| Composants standalone et imports `Ion*`    | Toutes les pages utilisent Ionic 9 depuis `@ionic/angular`         |
| `loadComponent`                            | Chargement des pages à la demande                                  |
| `inject`, `signal`, `computed`             | Services injectés, filtres réactifs, disponibilité et statistiques |
| Liste et détail d'un film                  | Agenda et détail d'un événement                                    |
| Service de favoris                         | Services de réservation persistée dans PostgreSQL                  |
| Formulaires d'ajout/modification           | Inscription, places réservées, catégories et événements            |
| Cycle de vie Ionic                         | `ionViewWillEnter` recharge les données quand une page réapparaît  |
| Capacitor                                  | Configuration native et dossier web `Frontend/www`                 |

## Parcours de lecture conseillé

1. `Frontend/src/app/app.config.ts` : activation d'Ionic, route strategy, client HTTP et intercepteur.
2. `Frontend/src/app/app.html` : menu latéral sur ordinateur et barre basse sur mobile.
3. `Frontend/src/app/app.routes.ts` : routes françaises, chargement différé et guards.
4. `features/events/pages/event-list` : état réactif, recherche, catégories et disponibilité.
5. `features/events/pages/event-detail` : formulaire réactif et confirmation Ionic.
6. `features/reservations` : édition, annulation et historique d'une réservation.
7. `features/admin` : CRUD complet et suivi des participants.
8. `core/services`, puis `Backend/src` : appels HTTP, JWT et règles métier côté serveur.

Les composants Ionic sont des composants d'interface. Angular conserve les formulaires, le routage et les services. Capacitor emballe ensuite le build web pour les plateformes natives ; il ne remplace pas l'API Express ni PostgreSQL.

## Détails utiles

- Ionic conserve certaines pages en mémoire : les lectures sont réactualisées à l'entrée et interrompues à la sortie. Les données privées et les confirmations sont nettoyées lors des changements de session.
- Les clés de session sont préfixées `eventhub_ionic_`, séparément du projet web original.
- Les services lisent `environment.apiBaseUrl`. L'intercepteur vérifie l'origine et le chemin avant d'ajouter le JWT.
- Les guards améliorent la navigation. Le backend reste responsable de vérifier le rôle, la propriété et la capacité disponible.
- La sélection de date d'administration utilise le champ `datetime-local` du navigateur pour saisir une heure locale explicitement, puis la convertit pour l'API.
- Le shell utilise `ChangeDetectionStrategy.Eager`, et les pages utilisent principalement des signals pour leur état.

## Petits exercices pour prolonger

- Ajouter les favoris d'événements avec un service, comme dans la démo des films.
- Ajouter une pagination côté API et une liste à chargement progressif.
- Ajouter un calendrier personnel ou un export de réservation.
- Brancher une API HTTPS de démonstration et tester une compilation Android avec Android Studio.
