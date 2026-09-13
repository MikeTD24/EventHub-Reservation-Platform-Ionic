import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subscription, finalize } from 'rxjs';
import {
  AlertController,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonMenuButton,
  IonContent,
  IonButton,
  IonInput,
  IonSpinner,
  IonBadge,
} from '@ionic/angular';

import { Categorie, CategorieResponse } from '../../../../core/models/categorie.model';
import { CategorieService } from '../../../../core/services/categorie.service';

@Component({
  selector: 'app-admin-categories',
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonMenuButton,
    IonContent,
    IonButton,
    IonInput,
    IonSpinner,
    IonBadge,
  ],
  templateUrl: './admin-categories.html',
  styleUrl: './admin-categories.scss',
})
export class AdminCategories {
  private readonly alertController = inject(AlertController);
  private readonly content = viewChild(IonContent);
  private readonly nameInput = viewChild(IonInput);
  private loadingSubscription?: Subscription;
  private mutationSubscription?: Subscription;
  private confirmationAlert?: HTMLIonAlertElement;
  private isViewActive = false;
  private readonly categorieService = inject(CategorieService);

  private readonly formBuilder = inject(FormBuilder);

  readonly categories = signal<Categorie[]>([]);
  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly deletingId = signal<number | null>(null);
  readonly editingId = signal<number | null>(null);
  readonly errorMessage = signal('');
  readonly actionMessage = signal('');
  readonly actionError = signal('');

  readonly categoriesCount = computed(() => this.categories().length);

  readonly isEditing = computed(() => this.editingId() !== null);

  /**
   * Le même formulaire sert à créer une catégorie
   * ou à modifier celle qui est sélectionnée.
   */
  readonly categorieForm = this.formBuilder.nonNullable.group({
    nom: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(100),
        Validators.pattern(/\S/),
      ],
    ],
  });

  ionViewWillEnter(): void {
    this.isViewActive = true;
    this.loadCategories();
  }

  ionViewWillLeave(): void {
    this.isViewActive = false;
    this.loadingSubscription?.unsubscribe();
    this.mutationSubscription?.unsubscribe();
    void this.confirmationAlert?.dismiss(undefined, 'cancel');
    this.categories.set([]);
    this.resetForm();
    this.actionMessage.set('');
    this.actionError.set('');
    this.errorMessage.set('');
    this.isLoading.set(true);
  }

  /**
   * Charge la liste triée des catégories depuis l’API.
   */
  loadCategories(): void {
    this.loadingSubscription?.unsubscribe();
    this.isLoading.set(true);
    this.errorMessage.set('');

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
   * Prépare le formulaire avec la catégorie à modifier.
   */
  startEditing(categorie: Categorie): void {
    this.editingId.set(categorie.id);

    this.categorieForm.setValue({
      nom: categorie.nom,
    });

    this.categorieForm.markAsPristine();
    this.actionMessage.set('');
    this.actionError.set('');
    void this.content()
      ?.scrollToTop(250)
      .then(() => this.nameInput()?.setFocus());
  }

  /**
   * Abandonne la modification et remet le formulaire
   * dans son état de création.
   */
  cancelEditing(): void {
    this.resetForm();
    this.actionError.set('');
  }

  /**
   * Crée ou modifie une catégorie selon la présence
   * d’un identifiant dans editingId.
   */
  submit(): void {
    if (this.isSubmitting()) return;
    this.categorieForm.controls.nom.setValue(this.categorieForm.controls.nom.value.trim());
    this.actionMessage.set('');
    this.actionError.set('');

    if (this.categorieForm.invalid) {
      this.categorieForm.markAllAsTouched();
      return;
    }

    const payload = {
      nom: this.categorieForm.controls.nom.value.trim(),
    };

    const editingId = this.editingId();

    let request$: Observable<CategorieResponse>;

    if (editingId === null) {
      request$ = this.categorieService.createCategorie(payload);
    } else {
      request$ = this.categorieService.updateCategorie(editingId, payload);
    }

    this.isSubmitting.set(true);

    this.mutationSubscription = request$
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
        }),
      )
      .subscribe({
        next: (response) => {
          if (editingId === null) {
            this.categories.update((categories) =>
              this.sortCategories([...categories, response.categorie]),
            );
          } else {
            this.categories.update((categories) =>
              this.sortCategories(
                categories.map((categorie) =>
                  categorie.id === editingId ? response.categorie : categorie,
                ),
              ),
            );
          }

          this.resetForm();
          this.actionMessage.set(response.message);
        },

        error: (error: HttpErrorResponse) => {
          this.actionError.set(
            this.getErrorMessage(error, 'Impossible d’enregistrer la catégorie.'),
          );
        },
      });
  }

  /**
   * Supprime une catégorie après confirmation.
   * Le backend refusera la suppression si elle contient
   * encore des événements.
   */
  async deleteCategorie(categorie: Categorie): Promise<void> {
    if (this.deletingId() !== null || this.isSubmitting()) return;
    const alert = await this.alertController.create({
      header: 'Supprimer la catégorie ?',
      subHeader: categorie.nom,
      message:
        'La suppression est possible uniquement si aucun événement ne dépend de cette catégorie.',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'Supprimer', role: 'destructive' },
      ],
    });
    if (!this.isViewActive) return;
    this.confirmationAlert = alert;
    await alert.present();
    const { role } = await alert.onDidDismiss();
    this.confirmationAlert = undefined;
    if (!this.isViewActive || role !== 'destructive' || this.deletingId() !== null) return;

    this.actionMessage.set('');
    this.actionError.set('');
    this.deletingId.set(categorie.id);

    this.mutationSubscription = this.categorieService
      .deleteCategorie(categorie.id)
      .pipe(
        finalize(() => {
          this.deletingId.set(null);
        }),
      )
      .subscribe({
        next: (response) => {
          this.categories.update((categories) =>
            categories.filter((current) => current.id !== categorie.id),
          );

          if (this.editingId() === categorie.id) {
            this.resetForm();
          }

          this.actionMessage.set(response.message);
        },

        error: (error: HttpErrorResponse) => {
          this.actionError.set(
            this.getErrorMessage(error, 'Impossible de supprimer la catégorie.'),
          );
        },
      });
  }

  private resetForm(): void {
    this.editingId.set(null);

    this.categorieForm.reset({
      nom: '',
    });
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
