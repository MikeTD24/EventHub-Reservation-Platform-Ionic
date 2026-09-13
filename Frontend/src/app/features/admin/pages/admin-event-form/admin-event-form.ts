import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, forkJoin, Observable, Subscription } from 'rxjs';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonContent,
  IonButton,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular';

import { Categorie } from '../../../../core/models/categorie.model';
import { EvenementPayload, EvenementResponse } from '../../../../core/models/evenement.model';
import { CategorieService } from '../../../../core/services/categorie.service';
import { EvenementService } from '../../../../core/services/evenement.service';

@Component({
  selector: 'app-admin-event-form',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonButton,
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonSpinner,
  ],
  templateUrl: './admin-event-form.html',
  styleUrl: './admin-event-form.scss',
})
export class AdminEventForm {
  private loadingSubscription?: Subscription;
  private mutationSubscription?: Subscription;
  private readonly activatedRoute = inject(ActivatedRoute);

  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly categorieService = inject(CategorieService);
  private readonly evenementService = inject(EvenementService);

  readonly categories = signal<Categorie[]>([]);
  readonly editingId = signal<number | null>(null);
  readonly placesOccupees = signal(0);
  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly submitError = signal('');

  readonly isEditMode = computed(() => this.editingId() !== null);

  /**
   * Lors d’une modification, la capacité ne peut jamais
   * devenir inférieure au nombre de places déjà réservées.
   */
  readonly minimumCapacity = computed(() => Math.max(1, this.placesOccupees()));

  readonly evenementForm = this.formBuilder.nonNullable.group({
    titre: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(150)]],
    description: [''],
    lieu: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(255)]],
    date_evenement: ['', Validators.required],
    places_totales: [1, [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]],
    id_categorie: [0, [Validators.required, Validators.min(1)]],
  });

  ionViewWillEnter(): void {
    this.loadingSubscription?.unsubscribe();
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.submitError.set('');
    this.editingId.set(null);
    this.placesOccupees.set(0);
    this.evenementForm.controls.places_totales.setValidators([
      Validators.required,
      Validators.min(1),
      Validators.pattern(/^\d+$/),
    ]);
    this.evenementForm.reset({
      titre: '',
      description: '',
      lieu: '',
      date_evenement: '',
      places_totales: 1,
      id_categorie: 0,
    });
    const idParam = this.activatedRoute.snapshot.paramMap.get('id');

    if (idParam === null) {
      this.loadCreationData();
      return;
    }

    const id = Number(idParam);

    if (!Number.isInteger(id) || id < 1) {
      this.isLoading.set(false);
      this.errorMessage.set('L’identifiant de l’événement est invalide.');
      return;
    }

    this.editingId.set(id);
    this.loadEditingData(id);
  }

  ionViewWillLeave(): void {
    this.loadingSubscription?.unsubscribe();
    this.mutationSubscription?.unsubscribe();
    this.categories.set([]);
    this.editingId.set(null);
    this.placesOccupees.set(0);
    this.errorMessage.set('');
    this.submitError.set('');
    this.evenementForm.reset();
    this.isLoading.set(true);
  }

  /**
   * En création, seules les catégories sont nécessaires.
   */
  private loadCreationData(): void {
    this.loadingSubscription = this.categorieService
      .getCategories()
      .pipe(
        finalize(() => {
          this.isLoading.set(false);
        }),
      )
      .subscribe({
        next: (categories) => {
          this.categories.set(this.sortCategories(categories));
        },

        error: (error: HttpErrorResponse) => {
          this.errorMessage.set(
            this.getErrorMessage(error, 'Impossible de charger les catégories.'),
          );
        },
      });
  }

  /**
   * En modification, les catégories et l’événement
   * sont chargés en parallèle.
   */
  private loadEditingData(id: number): void {
    this.loadingSubscription = forkJoin({
      categories: this.categorieService.getCategories(),
      evenement: this.evenementService.getEvenement(id),
    })
      .pipe(
        finalize(() => {
          this.isLoading.set(false);
        }),
      )
      .subscribe({
        next: ({ categories, evenement }) => {
          this.categories.set(this.sortCategories(categories));

          this.placesOccupees.set(evenement.places_occupees);

          /*
           * Le minimum dynamique protège les réservations
           * déjà enregistrées pour cet événement.
           */
          this.evenementForm.controls.places_totales.setValidators([
            Validators.required,
            Validators.min(this.minimumCapacity()),
            Validators.pattern(/^\d+$/),
          ]);

          this.evenementForm.patchValue({
            titre: evenement.titre,
            description: evenement.description ?? '',
            lieu: evenement.lieu,
            date_evenement: this.toDateTimeLocal(evenement.date_evenement),
            places_totales: evenement.places_totales,
            id_categorie: evenement.id_categorie,
          });

          this.evenementForm.controls.places_totales.updateValueAndValidity();

          this.evenementForm.markAsPristine();
        },

        error: (error: HttpErrorResponse) => {
          this.errorMessage.set(this.getErrorMessage(error, 'Impossible de charger l’événement.'));
        },
      });
  }

  /**
   * Crée ou modifie l’événement selon l’URL courante.
   */
  submit(): void {
    if (this.isSubmitting()) return;
    this.submitError.set('');

    if (this.evenementForm.invalid) {
      this.evenementForm.markAllAsTouched();
      return;
    }

    const values = this.evenementForm.getRawValue();
    const placesTotales = Number(values.places_totales);
    const idCategorie = Number(values.id_categorie);
    const dateEvenement = new Date(values.date_evenement);

    if (
      !Number.isInteger(placesTotales) ||
      !Number.isInteger(idCategorie) ||
      Number.isNaN(dateEvenement.getTime())
    ) {
      this.submitError.set('Certaines données du formulaire sont invalides.');
      return;
    }

    const payload: EvenementPayload = {
      titre: values.titre.trim(),
      description: values.description.trim() || null,
      lieu: values.lieu.trim(),
      date_evenement: dateEvenement.toISOString(),
      places_totales: placesTotales,
      id_categorie: idCategorie,
    };

    const editingId = this.editingId();
    let request$: Observable<EvenementResponse>;

    if (editingId === null) {
      request$ = this.evenementService.createEvenement(payload);
    } else {
      request$ = this.evenementService.updateEvenement(editingId, payload);
    }

    this.isSubmitting.set(true);

    this.mutationSubscription = request$
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
        }),
      )
      .subscribe({
        next: () => {
          void this.router.navigate(['/admin/evenements']);
        },

        error: (error: HttpErrorResponse) => {
          this.submitError.set(
            this.getErrorMessage(
              error,
              this.isEditMode()
                ? 'Impossible de modifier l’événement.'
                : 'Impossible de créer l’événement.',
            ),
          );
        },
      });
  }

  private toDateTimeLocal(value: string): string {
    const date = new Date(value);

    /*
     * datetime-local attend une heure locale sans fuseau.
     * Le décalage est retiré avant la conversion ISO.
     */
    const timezoneOffset = date.getTimezoneOffset() * 60_000;

    return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
  }

  private sortCategories(categories: Categorie[]): Categorie[] {
    return [...categories].sort((first, second) =>
      first.nom.localeCompare(second.nom, 'fr', {
        sensitivity: 'base',
      }),
    );
  }

  private getErrorMessage(error: HttpErrorResponse, fallback: string): string {
    if (error.status === 0) {
      return 'Impossible de joindre le serveur.';
    }

    return error.error?.message ?? fallback;
  }
}
