# Budget Couple

Application de budget de couple **mobile-first**, **sans backend** et **compatible GitHub Pages**.

## Pourquoi cette architecture

Cette version utilise uniquement :

- `index.html`
- `styles.css`
- `app.js`
- `localStorage`

Ce choix évite les causes classiques de page blanche en déploiement :

- chemins d'assets cassés après build ;
- base path GitHub Pages mal configuré ;
- dépendances front fragiles ;
- erreurs de build ou de runtime liées à un framework ;
- logique de stockage custom difficile à maintenir.

## Fonctionnalités

- tableau de bord avec patrimoine total et vue claire des soldes ;
- comptes multiples Canada / France ;
- dépenses, revenus et virements ;
- dépenses fixes mensuelles ;
- conversion EUR/CAD modifiable ;
- export / import JSON ;
- reset complet avec confirmation ;
- sauvegarde locale via `localStorage`.

## Test local immédiat

### Option ultra simple

Ouvrir `index.html` dans le navigateur.

### Option recommandée

Lancer un serveur statique local :

```bash
python3 -m http.server 8000
```

Puis ouvrir :

```text
http://localhost:8000
```

## Déploiement GitHub Pages

Comme le projet est 100 % statique, le déploiement est simple.

1. Poussez le dépôt sur GitHub.
2. Allez dans **Settings > Pages**.
3. Dans **Build and deployment** :
   - **Source** : `Deploy from a branch`
   - **Branch** : votre branche de publication (souvent `main`) ;
   - **Folder** : `/ (root)`.
4. Enregistrez.
5. GitHub Pages publiera directement `index.html`.

## Notes de fiabilité

- Aucun backend requis.
- Aucune dépendance npm.
- Aucun système de routing SPA.
- Tous les chemins sont relatifs (`./styles.css`, `./app.js`) pour éviter les erreurs de déploiement.
- Les imports JSON sont normalisés avant stockage pour éviter de casser l'application.
