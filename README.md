# Budget Couple

Application de budget de couple **mobile-first**, **compatible GitHub Pages** et désormais capable de se **synchroniser entre plusieurs appareils** via Supabase.

## Pourquoi cette architecture

Cette version utilise uniquement :

- `index.html`
- `styles.css`
- `app.js`
- `localStorage`

Et, si vous voulez partager les changements entre plusieurs appareils :

- **Supabase** comme stockage cloud optionnel.

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
- sauvegarde locale via `localStorage` ;
- synchronisation cloud optionnelle entre plusieurs appareils avec Supabase ;
- bouton de synchronisation manuelle et rafraîchissement automatique des changements distants.

## Synchronisation entre appareils

Par défaut, l'application continue de fonctionner en local uniquement.

Pour que les modifications faites sur l'appareil A apparaissent aussi sur l'appareil B :

1. Créez un projet Supabase.
2. Dans l'éditeur SQL, créez la table suivante :

```sql
create table if not exists public.app_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default timezone('utc', now())
);
```

3. Autorisez les lectures / écritures pour la clé `anon` utilisée par l'app statique. Exemple minimal :

```sql
alter table public.app_state enable row level security;

create policy "app_state_select"
on public.app_state
for select
to anon
using (true);

create policy "app_state_insert"
on public.app_state
for insert
to anon
with check (true);

create policy "app_state_update"
on public.app_state
for update
to anon
using (true)
with check (true);
```

4. Dans l'application, ouvrez l'onglet **Réglages** et renseignez :
   - l'URL Supabase ;
   - la clé publique `anon` ;
   - un identifiant partagé, par exemple `couple-budget-principal`.
5. Utilisez exactement les mêmes valeurs sur chaque appareil.

Ensuite :

- chaque sauvegarde locale envoie automatiquement l'état vers Supabase ;
- chaque appareil vérifie régulièrement s'il existe une version plus récente ;
- le bouton **Synchroniser maintenant** force une lecture puis une écriture immédiates.

### Limite actuelle

La stratégie est volontairement simple : **la dernière modification enregistrée gagne**.
Si deux appareils modifient l'application presque en même temps, la version la plus récente remplace l'autre.

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
