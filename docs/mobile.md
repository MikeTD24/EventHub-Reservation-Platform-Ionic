# Navigateur et application native

La version livrée est fonctionnelle dans le navigateur, avec une interface Ionic adaptée au mobile. Capacitor est configuré, mais aucun APK ni build iOS n'est livré. Un affichage mobile dans Chrome ne constitue pas un test sur un téléphone natif.

## Navigateur sur ce PC

À la racine : `npm start`, puis ouvrir http://localhost:8100. L'API utilise le port 3001. Le proxy Angular transmet `/api` vers cette API.

## Capacitor

`Frontend/capacitor.config.ts` définit `be.mikedja.eventhub`, le nom EventHub et `webDir: 'www'`. Le build Angular produit exactement ce dossier.

Les paquets Core, CLI, Android et iOS utilisent la même version. Pour ajouter Android, depuis `Frontend` :

```bat
npm run android:add
```

Avant une exécution native, modifier **`src/environments/environment.android.ts`** pour utiliser l'URL **HTTPS** d'une API accessible depuis l'appareil. Elle doit inclure `/api`. Le proxy Angular n'existe pas dans l'application native.

La valeur initiale `http://10.0.2.2:3001/api` indique l'adresse du PC depuis l'émulateur Android. Elle sert de repère de développement : Android/WebView peuvent bloquer le HTTP et le contenu mixte par défaut. Utiliser une API HTTPS évite de relâcher ces protections. `localhost` sur un téléphone désigne le téléphone lui-même, pas le PC.

Après configuration de l'URL :

```bat
npm run android:sync
npm run android:open
```

`android:sync` compile la configuration Angular `android` puis synchronise Capacitor. Android Studio et le SDK Android doivent être installés pour compiler, lancer et signer l'application. Réexécuter la synchronisation après chaque modification web. Pour une distribution, utiliser uniquement une API HTTPS de production et ses paramètres serveur appropriés.

iOS nécessite macOS et Xcode. Ne pas supposer qu'un build web ou Android valide le fonctionnement iOS.

Références : [workflow Capacitor](https://capacitorjs.com/docs/basics/workflow), [cycle de vie Ionic Angular](https://ionicframework.com/docs/angular/lifecycle).
