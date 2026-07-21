# StockPilot — Fichier de contexte du projet

> **Pour l'agent Claude Code qui reprend le projet** : ce fichier est ton fil conducteur. Lis-le en entier avant toute action. Il décrit le projet, l'architecture, tout ce qui a été fait, l'état actuel, les pièges, et la façon de travailler attendue (§11). Le code applicatif est propre et typé — la plupart des bugs rencontrés étaient des problèmes d'**environnement/build**, pas de logique (voir §10).

---

## 1. Vue d'ensemble

**StockPilot** est une **application desktop de gestion de stock de chaussures**, destinée au marché camerounais (montants en **FCFA**). C'est un logiciel **hors-ligne** (données locales SQLite), packagé en application native via Electron.

- **Domaine métier** : import de chaussures par conteneurs, gestion des **commandes fournisseur** (avec paiements échelonnés / avances), réceptions, transferts entre entrepôts/boutiques, suivi du stock, et statistiques.
- **Unité de vente** : le **carton** (contient N paires, souvent 12).
- **Langue de l'UI** : français.
- **Utilisateur cible** : un gérant / administrateur unique.

Le projet fait partie de l'écosystème « Feujio » (dossier parent `feujio/`), mais StockPilot est **autonome** (desktop, SQLite local), contrairement aux autres projets Feujio (API Laravel + frontends Next.js).

---

## 2. Stack technique

| Couche | Techno |
|---|---|
| Desktop | **Electron 32** |
| Frontend | **React 18 + TypeScript 5** (strict) |
| Build | **Vite 5** + `vite-plugin-electron` |
| Styles | **Tailwind CSS 3** (thème violet/primary, dark mode) |
| État | **Zustand** |
| Base de données | **SQLite** via **better-sqlite3** + **Drizzle ORM** |
| Icônes | lucide-react |
| Graphiques | Recharts |
| Packaging | **electron-builder** (+ script custom `scripts/package-mac.sh`) |
| Auto-update | **electron-updater** (GitHub Releases) |

---

## 3. Architecture

```
stockpilot/
├── electron/                 # Processus MAIN (Node) — accès DB, dialogues, IPC
│   ├── main.ts               # Point d'entrée : initDB → registerHandlers → createWindow → autoUpdate
│   ├── preload.ts            # Pont sécurisé : expose window.api au renderer
│   ├── updater.ts            # Auto-update electron-updater (lazy require, tolérant)
│   ├── db/
│   │   ├── schema.ts         # Schéma Drizzle (16 tables)
│   │   └── index.ts          # Init better-sqlite3 (userData/stockpilot.db)
│   ├── handlers/             # Handlers IPC par domaine (auth, seed, backup, print, dialog, …)
│   └── services/             # Logique métier + requêtes Drizzle
├── src/                      # Processus RENDERER (React)
│   ├── main.tsx              # Root : gate login/app + hydratation session + UpdateToast
│   ├── App.tsx               # Page unique scrollable + quick-nav collante (scroll-spy)
│   ├── pages/LoginPage.tsx   # Écran de connexion
│   ├── sections/             # OrdersSection, DashboardSection, StockSection, ArrivalsSection,
│   │                         #   CustomersSection, SuppliersSection
│   ├── components/           # UI, formulaires (Drawer), détails, UpdateToast
│   ├── store/                # app.store (UI) + auth-store (session)
│   ├── lib/utils.ts          # formatFcfa, formatDate, parseProductImages…
│   └── global.d.ts           # Types de window.api
├── docs/
│   ├── API_BACKEND_PROMPT.md    # Prompt pour créer l'API backend en ligne
│   └── RELEASE_AUTO_UPDATE.md   # Guide de publication des mises à jour
├── scripts/package-mac.sh    # Build .app macOS rapide (sans DMG)
├── electron-builder.json5    # Config packaging + publish GitHub
└── CONTEXT.md                # (ce fichier)
```

**Flux de données** : le renderer appelle `window.api.<domaine>.<action>()` → IPC → handler Electron → service → Drizzle/SQLite. Après toute écriture, `triggerRefresh()` (Zustand `dataVersion`) fait re-fetch les hooks.

**Source de vérité du stock** : la table `stock_movements` (quantités signées). Le stock courant = somme des mouvements.

---

## 4. Modèle de données (16 tables)

`warehouses`, `products`, `suppliers`, `customers`, `purchase_orders`, `purchase_order_items`, `carton_size_compositions`, `order_payments`, `receptions`, `reception_items`, `transfers`, `transfer_items`, `stock_movements`, et (historique, module retiré) `sales`, `sale_items`, `sale_payments`.

- IDs = UUID (string). Montants = **entiers FCFA** (jamais de float).
- Soft delete via `deletedAt`.
- Détail complet des champs : voir **`docs/API_BACKEND_PROMPT.md`** §3.

---

## 5. Fonctionnalités principales

- **Commandes fournisseur** (module central) : tableau « Excel » multi-lignes par commande (produits + fournisseur + prix), colonne **Paiements** (carte avec liste des avances/solde, barre de progression, statut Soldé/En cours).
  - Paiements multiples par commande, **type déduit automatiquement** du montant (Avance / Solde / Complet).
  - Confirmation avant suppression d'un paiement.
  - **Panneau « Ce que je dois à mes fournisseurs »** : total dû global + puces par fournisseur (montant dû + nb commandes), **filtrables**.
  - **Filtres** : par fournisseur (clic sur puce) et par **intervalle de dates** (Du → Au ; même date = jour précis).
  - **Export PDF** des commandes + dettes fournisseurs (respecte les filtres actifs).
  - En-tête de tableau **collant** (sticky) au scroll.
- **Dashboard, Stock & Catalogue, Arrivages (réceptions + transferts), Clients, Fournisseurs**.
- **Produits** : formulaire avec **photos** (jusqu'à 6, stockées en base64 dans `imageData`).
- **Outils** (header) : Export PDF global, Sauvegarder / Restaurer la base, **Données démo**, **Réinitialiser** (vider toutes les données), dark mode, déconnexion.
- **Formatage des prix** : séparateur milliers = point (`1.000.000 FCFA`).

---

## 6. Authentification & session

- **Identifiants** (dans `electron/handlers/auth.handler.ts`) :
  - email : `feujiodoungue@gmail.com`
  - mot de passe : `password`
- **Session persistante** : écrite dans un fichier `userData/session.json` côté main process (fiable en app packagée, contrairement au localStorage). → L'utilisateur reste connecté après fermeture/réouverture, **jusqu'au clic sur Déconnexion**.
- Au démarrage, `main.tsx` hydrate la session via `window.api.auth.getSession()` avant d'afficher l'app.

---

## 7. Build & distribution

- **Dev** : `npm run dev`
- **Build Mac rapide (.app, non signé)** : `npm run pack:mac` → `release/StockPilot-darwin-arm64/StockPilot.app`
- **Build Windows (.exe NSIS)** : `npx electron-builder --win --x64 --publish never` (fonctionne **sans Wine** sur macOS) → `release/1.0.0/StockPilot-Windows-1.0.0-Setup.exe` (~93 Mo, avec `latest.yml`)
- **Release + publication GitHub** : `export GH_TOKEN=… && npm run release:win` (ou `release:mac`)

### Auto-update (electron-updater + GitHub Releases)
- Configuré dans `electron-builder.json5` (`publish: github, owner: franckDev21, repo: stockpilot`).
- L'app vérifie les mises à jour au lancement + toutes les 4 h, télécharge en arrière-plan, puis propose **« Redémarrer et installer »** (composant `UpdateToast`).
- **Windows** : auto-update fonctionne **sans signature** (juste un avertissement SmartScreen à la 1ʳᵉ install).
- **macOS** : auto-update **nécessite** signature + notarisation Apple (99 $/an) — sinon réinstallation manuelle du .dmg.
- Guide complet : **`docs/RELEASE_AUTO_UPDATE.md`**.

---

## 8. État actuel (au moment de l'écriture)

- ✅ Version **1.0.0**.
- ✅ Installeur **Windows 1.0.0 généré** (copié sur le Bureau).
- ✅ Identifiants + session persistante + auto-update en place.
- ✅ Module Ventes **retiré** de l'UI (tables encore présentes en base).
- ✅ Module « Créances clients » retiré.
- ✅ Dépôt **poussé sur GitHub** : `git@github.com:franckDev21/stockpilot.git`, branche `main`.
  - Historique **reparti à zéro** (commit unique propre) pour purger un binaire Electron de 148 Mo qui dépassait la limite GitHub (100 Mo/fichier).
  - `release/` et `dist-electron/` sont **gitignorés**.

---

## 9. Points en attente / à décider

- [ ] **Créer le repo GitHub `stockpilot`** côté serveur et **publier la 1ʳᵉ release** (nécessaire pour que l'auto-update ait une référence).
- [ ] **README** : contient encore le texte par défaut de Vite → à remplacer par une vraie présentation.
- [ ] **Signature de code** : Windows (optionnel, supprime l'avertissement SmartScreen) ; macOS (obligatoire pour l'auto-update mac).
- [ ] **API backend en ligne** : spec prête dans `docs/API_BACKEND_PROMPT.md` — à implémenter sur le serveur pour sauvegarder/synchroniser les données en ligne (offline-first à prévoir).
- [ ] (Option) **GitHub Actions** pour builder Windows + Mac automatiquement à chaque tag.
- [ ] Tables `sales*` orphelines : à supprimer du schéma si le module Ventes ne revient pas.

---

## 10. Pièges connus (gotchas)

- **better-sqlite3 / architecture** : un build Windows (`electron-builder --win`) recompile better-sqlite3 pour win-x64. Pour relancer en local sur Mac (`npm run dev` / `pack:mac`), refaire `npm install` pour restaurer le binaire arm64. Symptôme d'un mauvais binaire : `dlopen … slice is not valid mach-o file` → `initDatabase()` plante → **aucun handler IPC enregistré** → erreurs `No handler registered for '…'`.
- **Dialogue d'image** : `dialog.showOpenDialog` doit être rattaché à la fenêtre (`BrowserWindow.fromWebContents`) sinon il s'ouvre derrière l'app sur macOS.
- **Impression PDF scoped** : on ajoute temporairement la classe `print-target` à l'élément à imprimer (voir `@media print` dans `index.css`).
- **Données démo** : le bouton « Données démo » (menu Outils) **recharge de fausses données** — ne pas cliquer pendant les tests réels. Utiliser « Réinitialiser » pour repartir de zéro.

---

## 11. Pour l'agent qui reprend le projet (fil conducteur)

### Répertoire de travail
`/Users/angelstore/Documents/projets/feujio/stockpilot` (sur le Mac de l'utilisateur). Git : branche `main`, remote `git@github.com:franckDev21/stockpilot.git`.

### Boucle de travail attendue (à chaque changement)
1. Modifier le code.
2. **`npx tsc --noEmit`** → doit renvoyer 0 erreur (le projet est en TS strict ; corrige les imports inutilisés, ils bloquent le build).
3. Tester : `npm run dev` (dev), ou `npm run pack:mac` (build .app Mac local) pour vérifier concrètement.
4. **Commit** avec un message clair (`feat:`, `fix:`, `chore:`…). L'utilisateur apprécie des commits atomiques et un push explicite quand il le demande.

### Où intervenir selon la tâche
| Tâche | Fichier(s) |
|---|---|
| Identifiants / session | `electron/handlers/auth.handler.ts`, `src/store/auth-store.ts`, `src/main.tsx` |
| Tableau des commandes / paiements / dettes / filtres / PDF | `src/sections/OrdersSection.tsx` (gros fichier, cœur de l'app) |
| Formulaire produit / images | `src/components/forms/ProductForm.tsx`, `electron/handlers/dialog.handler.ts` |
| Schéma DB / nouvelles tables | `electron/db/schema.ts` (+ migration `npm run db:generate`) |
| Nouvel endpoint IPC | handler dans `electron/handlers/` → `electron/preload.ts` → `src/global.d.ts` (les 3 doivent être synchronisés) |
| Auto-update | `electron/updater.ts`, `src/components/UpdateToast.tsx`, `electron-builder.json5` |
| Navigation / sections | `src/App.tsx` (page unique + quick-nav) |
| Formatage prix/date | `src/lib/utils.ts` (fonctions centrales `formatFcfa`, `formatDate`) |

### Conventions à respecter
- **Argent en entiers FCFA**, jamais de float. Affichage via `formatFcfa()` uniquement.
- **UI en français**, ton sobre et pro. Thème Tailwind existant (primary violet), dark mode supporté.
- Toute écriture DB depuis le renderer passe par un **service** (jamais de logique métier dans les composants) et déclenche `triggerRefresh()`.
- **Confirmation** avant toute action destructive (via `openModal` du store, ou `window.confirm`).
- Ajout d'un canal IPC = **3 fichiers à synchroniser** (handler + preload + global.d.ts), sinon erreur `No handler registered`.
- Le **stock ne se stocke pas** dans un champ : il se **calcule** depuis `stock_movements`.

### Historique de la session précédente (résumé du « nous »)
Le module Commandes fournisseur a été profondément retravaillé (design itératif avec l'utilisateur : colonnes de paiement inline → carte Paiements dédiée). Ont été ajoutés : filtres fournisseur + intervalle de dates, panneau des dettes, export PDF commandes+dettes, formatage des prix, en-tête collant. Les modules **Ventes** et **Créances clients** ont été **retirés**. Côté plateforme : bouton Réinitialiser (vider la base), correctif du sélecteur d'image (dialogue rattaché à la fenêtre), nouveaux identifiants, **session persistante par fichier**, **auto-update GitHub**, build Windows, et **push GitHub** (historique reparti à zéro pour purger un gros binaire).

### Style de collaboration de l'utilisateur
- Francophone, va droit au but, itère beaucoup sur l'UI (souvent via captures d'écran annotées).
- Quand une demande UI n'est pas claire, **poser une question / proposer des options AVANT de coder** (il l'a demandé explicitement).
- Il teste sur **Windows** et **Mac** ; livrer des builds concrets et des instructions d'installation.
```
