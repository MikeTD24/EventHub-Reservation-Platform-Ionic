import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Subscription } from 'rxjs';
import {
  AlertController,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonLabel,
  IonMenuButton,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  arrowForwardOutline,
  calendarOutline,
  checkmarkCircleOutline,
  createOutline,
  locationOutline,
  ticketOutline,
  trashOutline,
} from 'ionicons/icons';
import { Reservation, ReservationResponse } from '../../../../core/models/reservation.model';
import { ReservationService } from '../../../../core/services/reservation.service';
import { AuthService } from '../../../../core/services/auth.service';

type ReservationFilter = 'all' | 'upcoming' | 'history';

@Component({
  selector: 'app-my-reservations',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    IonBadge,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonLabel,
    IonMenuButton,
    IonRefresher,
    IonRefresherContent,
    IonSegment,
    IonSegmentButton,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './my-reservations.html',
  styleUrl: './my-reservations.scss',
})
export class MyReservations {
  private readonly reservationService = inject(ReservationService);
  private readonly authService = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly alerts = inject(AlertController);
  private readonly destroyRef = inject(DestroyRef);
  private loadRequest?: Subscription;
  private actionRequest?: Subscription;
  private confirmation?: HTMLIonAlertElement;
  private viewActive = false;

  readonly reservations = signal<Reservation[]>([]);
  readonly isAuthenticated = this.authService.isAuthenticated;
  readonly isLoading = signal(true);
  readonly isConfirming = signal(false);
  readonly errorMessage = signal('');
  readonly actionMessage = signal('');
  readonly actionError = signal('');
  readonly editingId = signal<number | null>(null);
  readonly actionId = signal<number | null>(null);
  readonly activeFilter = signal<ReservationFilter>('all');
  readonly activeCount = computed(
    () => this.reservations().filter((reservation) => this.canManage(reservation)).length,
  );
  readonly filteredReservations = computed(() =>
    this.reservations().filter(
      (reservation) =>
        this.activeFilter() === 'all' ||
        (this.activeFilter() === 'upcoming'
          ? this.canManage(reservation)
          : !this.canManage(reservation)),
    ),
  );
  readonly editForm = this.formBuilder.nonNullable.group({
    nombre_places: [1, [Validators.required, Validators.min(1)]],
  });

  constructor() {
    addIcons({
      arrowForwardOutline,
      calendarOutline,
      checkmarkCircleOutline,
      createOutline,
      locationOutline,
      ticketOutline,
      trashOutline,
    });
    let previousSession = this.authService.getToken();
    effect(() => {
      const session = this.authService.getToken();
      if (previousSession !== session) {
        previousSession = session;
        this.loadRequest?.unsubscribe();
        this.actionRequest?.unsubscribe();
        void this.confirmation?.dismiss(undefined, 'cancel');
        this.reservations.set([]);
        this.stopEditing();
        this.errorMessage.set('');
        this.actionMessage.set('');
        this.actionError.set('');
        this.isLoading.set(false);
        if (session && this.viewActive) this.loadReservations();
      }
    });
  }

  ionViewWillEnter(): void {
    this.viewActive = true;
    this.stopEditing();
    this.loadReservations();
  }

  ionViewWillLeave(): void {
    this.viewActive = false;
    this.loadRequest?.unsubscribe();
    this.actionRequest?.unsubscribe();
    void this.confirmation?.dismiss(undefined, 'cancel');
  }

  loadReservations(refresher?: RefresherCustomEvent): void {
    this.loadRequest?.unsubscribe();
    const session = this.authService.getToken();
    this.stopEditing();
    this.errorMessage.set('');
    this.actionMessage.set('');
    this.actionError.set('');
    this.reservations.set([]);
    if (!session) {
      this.isLoading.set(false);
      void refresher?.target.complete();
      return;
    }
    this.isLoading.set(true);
    this.loadRequest = this.reservationService
      .getMesReservations()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoading.set(false);
          void refresher?.target.complete();
        }),
      )
      .subscribe({
        next: (reservations) => {
          if (session === this.authService.getToken()) this.reservations.set(reservations);
        },
        error: (error: HttpErrorResponse) => {
          if (session === this.authService.getToken())
            this.errorMessage.set(
              this.getErrorMessage(error, 'Impossible de charger vos réservations.'),
            );
        },
      });
  }

  setFilter(value: unknown): void {
    if (value === 'all' || value === 'upcoming' || value === 'history')
      this.activeFilter.set(value);
  }

  startEditing(reservation: Reservation): void {
    if (!this.canManage(reservation) || this.actionId() !== null || this.isConfirming()) return;
    this.editForm.controls.nombre_places.setValidators([
      Validators.required,
      Validators.min(1),
      Validators.max(this.maximumPlaces(reservation)),
      (control) => (Number.isInteger(control.value) ? null : { integer: true }),
    ]);
    this.editForm.reset({ nombre_places: reservation.nombre_places });
    this.editingId.set(reservation.id);
    this.actionMessage.set('');
    this.actionError.set('');
  }

  stopEditing(): void {
    this.editingId.set(null);
    this.editForm.reset({ nombre_places: 1 });
  }

  async saveReservation(reservation: Reservation): Promise<void> {
    if (this.actionId() !== null || this.isConfirming() || !this.canManage(reservation)) return;
    this.actionMessage.set('');
    this.actionError.set('');
    const count = this.editForm.controls.nombre_places.value;
    if (this.editForm.invalid || !Number.isInteger(count)) {
      this.editForm.markAllAsTouched();
      return;
    }
    const session = this.authService.getToken();
    if (
      !session ||
      !(await this.confirmAction(
        'Modifier la réservation',
        'Remplacer votre réservation par ' + count + ' place(s) ?',
        'Enregistrer',
      ))
    )
      return;
    if (session !== this.authService.getToken() || !this.canManage(reservation) || !this.viewActive)
      return;
    this.actionId.set(reservation.id);
    this.actionRequest = this.reservationService
      .updateReservation(reservation.id, { nombre_places: count })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.actionId.set(null)),
      )
      .subscribe({
        next: (response) => {
          if (session !== this.authService.getToken()) return;
          this.updateLocalReservation(reservation.id, response);
          this.stopEditing();
          this.actionMessage.set(response.message);
        },
        error: (error: HttpErrorResponse) => {
          if (session === this.authService.getToken())
            this.actionError.set(
              this.getErrorMessage(error, 'Impossible de modifier la réservation.'),
            );
        },
      });
  }

  async cancelReservation(reservation: Reservation): Promise<void> {
    if (this.actionId() !== null || this.isConfirming() || !this.canManage(reservation)) return;
    const session = this.authService.getToken();
    if (
      !session ||
      !(await this.confirmAction(
        'Annuler la réservation',
        'Vos ' +
          reservation.nombre_places +
          ' place(s) seront libérées pour les autres participants.',
        'Annuler la réservation',
      ))
    )
      return;
    if (session !== this.authService.getToken() || !this.canManage(reservation) || !this.viewActive)
      return;
    this.actionMessage.set('');
    this.actionError.set('');
    this.actionId.set(reservation.id);
    this.actionRequest = this.reservationService
      .cancelReservation(reservation.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.actionId.set(null)),
      )
      .subscribe({
        next: (response) => {
          if (session !== this.authService.getToken()) return;
          this.updateLocalReservation(reservation.id, response);
          this.stopEditing();
          this.actionMessage.set(response.message);
        },
        error: (error: HttpErrorResponse) => {
          if (session === this.authService.getToken())
            this.actionError.set(
              this.getErrorMessage(error, 'Impossible d’annuler la réservation.'),
            );
        },
      });
  }

  canManage(reservation: Reservation): boolean {
    return (
      reservation.statut === 'confirmee' &&
      reservation.evenement !== undefined &&
      !this.isPast(reservation)
    );
  }

  isPast(reservation: Reservation): boolean {
    return (
      !reservation.evenement ||
      new Date(reservation.evenement.date_evenement).getTime() <= Date.now()
    );
  }

  maximumPlaces(reservation: Reservation): number {
    return reservation.nombre_places + (reservation.evenement?.places_restantes ?? 0);
  }

  private async confirmAction(
    header: string,
    message: string,
    confirmText: string,
  ): Promise<boolean> {
    this.isConfirming.set(true);
    try {
      this.confirmation = await this.alerts.create({
        header,
        message,
        buttons: [
          { text: 'Revenir', role: 'cancel' },
          { text: confirmText, role: 'confirm' },
        ],
      });
      await this.confirmation.present();
      return (await this.confirmation.onDidDismiss()).role === 'confirm';
    } finally {
      this.isConfirming.set(false);
      this.confirmation = undefined;
    }
  }

  private updateLocalReservation(id: number, response: ReservationResponse): void {
    this.reservations.update((reservations) =>
      reservations.map((current) => {
        const evenement =
          current.evenement?.id === response.reservation.id_evenement
            ? {
                ...current.evenement,
                places_restantes: response.places_restantes,
                places_occupees: current.evenement.places_totales - response.places_restantes,
              }
            : current.evenement;
        return current.id === id
          ? { ...current, ...response.reservation, evenement }
          : { ...current, evenement };
      }),
    );
  }

  private getErrorMessage(error: HttpErrorResponse, fallback: string): string {
    return error.status === 0
      ? 'Le serveur est injoignable. Réessayez dans un instant.'
      : (error.error?.message ?? fallback);
  }
}
