import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Subscription } from 'rxjs';
import {
  AlertController,
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonProgressBar,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  calendarOutline,
  checkmarkCircleOutline,
  locationOutline,
  peopleOutline,
  ticketOutline,
  timeOutline,
} from 'ionicons/icons';
import { Evenement } from '../../../../core/models/evenement.model';
import { AuthService } from '../../../../core/services/auth.service';
import { EvenementService } from '../../../../core/services/evenement.service';
import { ReservationService } from '../../../../core/services/reservation.service';

@Component({
  selector: 'app-event-detail',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    IonBackButton,
    IonBadge,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonProgressBar,
    IonRefresher,
    IonRefresherContent,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './event-detail.html',
  styleUrl: './event-detail.scss',
})
export class EventDetail {
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly evenementService = inject(EvenementService);
  private readonly reservationService = inject(ReservationService);
  private readonly authService = inject(AuthService);
  private readonly alerts = inject(AlertController);
  private readonly destroyRef = inject(DestroyRef);
  private loadRequest?: Subscription;
  private reservationRequest?: Subscription;
  private confirmation?: HTMLIonAlertElement;

  readonly evenement = signal<Evenement | null>(null);
  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly isConfirming = signal(false);
  readonly errorMessage = signal('');
  readonly reservationError = signal('');
  readonly successMessage = signal('');
  readonly isAuthenticated = this.authService.isAuthenticated;
  readonly reservationForm = this.formBuilder.nonNullable.group({
    nombre_places: [
      1,
      [
        Validators.required,
        Validators.min(1),
        (control: { value: number }) =>
          Number.isInteger(control.value) ? null : { integer: true },
      ],
    ],
  });

  constructor() {
    addIcons({
      calendarOutline,
      checkmarkCircleOutline,
      locationOutline,
      peopleOutline,
      ticketOutline,
      timeOutline,
    });
    let previousSession = this.authService.getToken();
    effect(() => {
      const session = this.authService.getToken();
      if (session !== previousSession) {
        previousSession = session;
        this.reservationRequest?.unsubscribe();
        void this.confirmation?.dismiss(undefined, 'cancel');
        this.successMessage.set('');
        this.reservationError.set('');
        this.reservationForm.reset({ nombre_places: 1 });
      }
    });
  }

  ionViewWillEnter(): void {
    this.successMessage.set('');
    this.reservationError.set('');
    this.reservationForm.reset({ nombre_places: 1 });
    this.loadEvenement();
  }

  ionViewWillLeave(): void {
    this.loadRequest?.unsubscribe();
    this.reservationRequest?.unsubscribe();
    void this.confirmation?.dismiss(undefined, 'cancel');
  }

  loadEvenement(refresher?: RefresherCustomEvent): void {
    this.loadRequest?.unsubscribe();
    const id = Number(this.activatedRoute.snapshot.paramMap.get('id'));
    if (!Number.isInteger(id) || id < 1) {
      this.evenement.set(null);
      this.isLoading.set(false);
      this.errorMessage.set('L’identifiant de l’événement est invalide.');
      void refresher?.target.complete();
      return;
    }
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.loadRequest = this.evenementService
      .getEvenement(id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoading.set(false);
          void refresher?.target.complete();
        }),
      )
      .subscribe({
        next: (event) => {
          this.evenement.set(event);
          this.updateMaximum(event.places_restantes);
        },
        error: (error: HttpErrorResponse) =>
          this.errorMessage.set(
            this.getErrorMessage(error, 'Impossible de charger cet événement.'),
          ),
      });
  }

  async reserver(): Promise<void> {
    if (this.isSubmitting() || this.isConfirming()) return;
    const event = this.evenement();
    this.reservationError.set('');
    this.successMessage.set('');
    if (!event || this.isPast(event) || event.places_restantes < 1) return;
    const session = this.authService.getToken();
    if (!session || !this.isAuthenticated()) {
      await this.router.navigate(['/connexion'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    const count = this.reservationForm.controls.nombre_places.value;
    if (this.reservationForm.invalid || !Number.isInteger(count)) {
      this.reservationForm.markAllAsTouched();
      return;
    }
    if (count > event.places_restantes) {
      this.reservationError.set('Il ne reste que ' + event.places_restantes + ' place(s).');
      return;
    }
    this.isConfirming.set(true);
    let confirmed = false;
    try {
      this.confirmation = await this.alerts.create({
        header: 'Confirmer la réservation',
        message: 'Réserver ' + count + ' place(s) pour cet événement ?',
        buttons: [
          { text: 'Revenir', role: 'cancel' },
          { text: 'Confirmer', role: 'confirm' },
        ],
      });
      await this.confirmation.present();
      confirmed = (await this.confirmation.onDidDismiss()).role === 'confirm';
    } finally {
      this.isConfirming.set(false);
      this.confirmation = undefined;
    }
    if (!confirmed || session !== this.authService.getToken() || this.isPast(event)) return;
    this.isSubmitting.set(true);
    this.reservationRequest = this.reservationService
      .createReservation({
        id_evenement: event.id,
        nombre_places: count,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSubmitting.set(false)),
      )
      .subscribe({
        next: (response) => {
          if (session !== this.authService.getToken()) return;
          this.successMessage.set(response.message);
          this.evenement.update((current) =>
            current
              ? {
                  ...current,
                  places_restantes: response.places_restantes,
                  places_occupees: current.places_totales - response.places_restantes,
                }
              : null,
          );
          this.updateMaximum(response.places_restantes);
          this.reservationForm.reset({ nombre_places: 1 });
        },
        error: (error: HttpErrorResponse) => {
          if (session === this.authService.getToken())
            this.reservationError.set(
              this.getErrorMessage(error, 'Impossible de créer la réservation.'),
            );
        },
      });
  }

  isPast(event: Evenement): boolean {
    return new Date(event.date_evenement).getTime() <= Date.now();
  }
  occupation(event: Evenement): number {
    return event.places_totales > 0
      ? Math.max(0, Math.min(1, event.places_occupees / event.places_totales))
      : 0;
  }

  private updateMaximum(maximum: number): void {
    this.reservationForm.controls.nombre_places.setValidators([
      Validators.required,
      Validators.min(1),
      Validators.max(maximum),
      (control) => (Number.isInteger(control.value) ? null : { integer: true }),
    ]);
    this.reservationForm.controls.nombre_places.updateValueAndValidity();
  }

  private getErrorMessage(error: HttpErrorResponse, fallback: string): string {
    return error.status === 0
      ? 'Le serveur est injoignable. Réessayez dans un instant.'
      : (error.error?.message ?? fallback);
  }
}
