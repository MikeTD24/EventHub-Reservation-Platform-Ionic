import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Subscription } from 'rxjs';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonLabel,
  IonMenuButton,
  IonProgressBar,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  arrowForwardOutline,
  calendarOutline,
  locationOutline,
  sparklesOutline,
} from 'ionicons/icons';
import { Evenement } from '../../../../core/models/evenement.model';
import { EvenementService } from '../../../../core/services/evenement.service';

type EventFilter = 'all' | 'upcoming' | 'available';

@Component({
  selector: 'app-event-list',
  imports: [
    DatePipe,
    RouterLink,
    IonBadge,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonIcon,
    IonLabel,
    IonMenuButton,
    IonProgressBar,
    IonRefresher,
    IonRefresherContent,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './event-list.html',
  styleUrl: './event-list.scss',
})
export class EventList {
  private readonly evenementService = inject(EvenementService);
  private readonly destroyRef = inject(DestroyRef);
  private loadRequest?: Subscription;
  readonly evenements = signal<Evenement[]>([]);
  readonly activeFilter = signal<EventFilter>('all');
  readonly search = signal('');
  readonly categoryId = signal('all');
  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly categories = computed(() =>
    [
      ...new Map(this.evenements().map((event) => [event.categorie.id, event.categorie])).values(),
    ].sort((a, b) => a.nom.localeCompare(b.nom)),
  );
  readonly upcomingCount = computed(
    () => this.evenements().filter((event) => !this.isPast(event)).length,
  );
  readonly filteredEvenements = computed(() => {
    const query = this.normalize(this.search().trim());
    return this.evenements().filter((event) => {
      const matchesFilter =
        this.activeFilter() === 'all' ||
        (!this.isPast(event) &&
          (this.activeFilter() !== 'available' || event.places_restantes > 0));
      const matchesCategory =
        this.categoryId() === 'all' || String(event.categorie.id) === this.categoryId();
      const matchesSearch =
        !query ||
        this.normalize(
          event.titre +
            ' ' +
            (event.description ?? '') +
            ' ' +
            event.lieu +
            ' ' +
            event.categorie.nom,
        ).includes(query);
      return matchesFilter && matchesCategory && matchesSearch;
    });
  });

  constructor() {
    addIcons({ arrowForwardOutline, calendarOutline, locationOutline, sparklesOutline });
  }
  ionViewWillEnter(): void {
    this.loadEvenements();
  }
  ionViewWillLeave(): void {
    this.loadRequest?.unsubscribe();
  }

  loadEvenements(refresher?: RefresherCustomEvent): void {
    this.loadRequest?.unsubscribe();
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.loadRequest = this.evenementService
      .getEvenements()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoading.set(false);
          void refresher?.target.complete();
        }),
      )
      .subscribe({
        next: (events) => this.evenements.set(events),
        error: (error: HttpErrorResponse) =>
          this.errorMessage.set(
            error.status === 0
              ? 'Le serveur est momentanément injoignable. Vérifiez votre connexion puis réessayez.'
              : (error.error?.message ?? 'Impossible de charger les événements.'),
          ),
      });
  }

  setFilter(value: unknown): void {
    if (value === 'all' || value === 'upcoming' || value === 'available')
      this.activeFilter.set(value);
  }

  resetFilters(): void {
    this.activeFilter.set('all');
    this.categoryId.set('all');
    this.search.set('');
  }

  occupation(event: Evenement): number {
    return event.places_totales > 0
      ? Math.max(0, Math.min(1, event.places_occupees / event.places_totales))
      : 0;
  }

  availabilityColor(event: Evenement): string {
    if (this.isPast(event) || event.places_restantes === 0) return 'medium';
    return event.places_restantes <= Math.max(5, event.places_totales * 0.2)
      ? 'warning'
      : 'success';
  }

  availabilityLabel(event: Evenement): string {
    if (this.isPast(event)) return 'Terminé';
    if (event.places_restantes === 0) return 'Complet';
    return this.availabilityColor(event) === 'warning' ? 'Dernières places' : 'Places disponibles';
  }

  private isPast(event: Evenement): boolean {
    return new Date(event.date_evenement).getTime() <= Date.now();
  }
  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('fr');
  }
}
