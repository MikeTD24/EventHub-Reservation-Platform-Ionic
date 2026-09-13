import { Routes } from '@angular/router';

import { Login } from './features/auth/pages/login/login';
import { Register } from './features/auth/pages/register/register';
import { EventDetail } from './features/events/pages/event-detail/event-detail';
import { EventList } from './features/events/pages/event-list/event-list';
import { MyReservations } from './features/reservations/pages/my-reservations/my-reservations';
import { NotFound } from './shared/pages/not-found/not-found';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { AdminCategories } from './features/admin/pages/admin-categories/admin-categories';
import { AdminEventList } from './features/admin/pages/admin-event-list/admin-event-list';
import { AdminEventForm } from './features/admin/pages/admin-event-form/admin-event-form';
import { AdminEventParticipants } from './features/admin/pages/admin-event-participants/admin-event-participants';

export const routes: Routes = [
  /*
   * L’adresse principale redirige vers la liste des événements.
   */
  {
    path: '',
    redirectTo: 'evenements',
    pathMatch: 'full',
  },

  {
    path: 'connexion',
    loadComponent: () => import('./features/auth/pages/login/login').then((m) => m.Login),
    title: 'Connexion',
  },
  {
    path: 'inscription',
    loadComponent: () => import('./features/auth/pages/register/register').then((m) => m.Register),
    title: 'Inscription',
  },
  {
    path: 'evenements',
    loadComponent: () =>
      import('./features/events/pages/event-list/event-list').then((m) => m.EventList),
    title: 'Événements',
  },
  {
    path: 'evenements/:id',
    loadComponent: () =>
      import('./features/events/pages/event-detail/event-detail').then((m) => m.EventDetail),
    title: 'Détail de l’événement',
  },
  {
    path: 'mes-reservations',
    loadComponent: () =>
      import('./features/reservations/pages/my-reservations/my-reservations').then(
        (m) => m.MyReservations,
      ),
    canActivate: [authGuard],
    title: 'Mes réservations',
  },
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    canActivateChild: [authGuard, adminGuard],
    children: [
      {
        path: '',
        redirectTo: 'evenements',
        pathMatch: 'full',
      },
      {
        path: 'evenements',
        loadComponent: () =>
          import('./features/admin/pages/admin-event-list/admin-event-list').then(
            (m) => m.AdminEventList,
          ),
        title: 'Gestion des événements',
      },
      {
        path: 'evenements/nouveau',
        loadComponent: () =>
          import('./features/admin/pages/admin-event-form/admin-event-form').then(
            (m) => m.AdminEventForm,
          ),
        title: 'Créer un événement',
      },
      {
        path: 'evenements/:id/modifier',
        loadComponent: () =>
          import('./features/admin/pages/admin-event-form/admin-event-form').then(
            (m) => m.AdminEventForm,
          ),
        title: 'Modifier un événement',
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./features/admin/pages/admin-categories/admin-categories').then(
            (m) => m.AdminCategories,
          ),
        title: 'Gestion des catégories',
      },
      {
        path: 'evenements/:id/reservations',
        loadComponent: () =>
          import('./features/admin/pages/admin-event-participants/admin-event-participants').then(
            (m) => m.AdminEventParticipants,
          ),
        title: 'Participants de l’événement',
      },
    ],
  },

  /*
   * Cette route doit rester en dernière position.
   * Elle intercepte toutes les adresses inconnues.
   */
  {
    path: '**',
    loadComponent: () => import('./shared/pages/not-found/not-found').then((m) => m.NotFound),
    title: 'Page introuvable',
  },
];
