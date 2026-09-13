import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  IonApp,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonMenu,
  IonMenuToggle,
  IonRouterOutlet,
  IonSplitPane,
  NavController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  calendarOutline,
  ticketOutline,
  personCircleOutline,
  gridOutline,
  layersOutline,
  logOutOutline,
  arrowForwardOutline,
  sparklesOutline,
} from 'ionicons/icons';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterLink,
    RouterLinkActive,
    IonApp,
    IonContent,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonMenu,
    IonMenuToggle,
    IonRouterOutlet,
    IonSplitPane,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly auth = inject(AuthService);
  private readonly nav = inject(NavController);
  constructor() {
    addIcons({
      calendarOutline,
      ticketOutline,
      personCircleOutline,
      gridOutline,
      layersOutline,
      logOutOutline,
      arrowForwardOutline,
      sparklesOutline,
    });
  }
  logout(): void {
    this.auth.logout();
    // Efface la pile de pages privées conservée par Ionic.
    void this.nav.navigateRoot('/connexion', { replaceUrl: true });
  }
}
