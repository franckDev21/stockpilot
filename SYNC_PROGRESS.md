# Synchronisation des deux postes — suivi

**Démarré le 2026-08-17.** Fichier de reprise : si la session est coupée, tout ce qu'il
faut savoir pour continuer est ici.

## Le problème

Le client travaille sur **deux installations** de StockPilot : le PC de son bureau et le
portable perso de Franck. Les deux ont divergé — chacune a des données que l'autre n'a pas.

## Diagnostic (vérifié, pas supposé)

1. **La base en ligne était vide de données métier** : 3 entrepôts, 2 fournisseurs,
   1 produit, et **0 commande, 0 réception, 0 paiement, 0 mouvement de stock**.
   → la synchro n'a jamais tourné pour de vrai ; les deux postes n'ont jamais eu de
   point de rendez-vous.
2. **Les ventes n'existaient pas côté API.** Le desktop gère `sales` / `sale_items` /
   `sale_payments` depuis toujours ; l'API n'avait aucune de ces tables et `runSync` ne
   les mentionnait pas. Aucune vente n'a jamais pu passer d'un poste à l'autre.
3. **Les suppressions ne circulaient pas**, dans les deux sens : le push faisait
   `continue` sur toute ligne supprimée, et les `index()` de l'API masquaient les lignes
   supprimées (portée `SoftDeletes`) → `deletedAt` renvoyé toujours nul.
4. **Le stock ne suivait pas au pull.** Le poste qui *recevait* une réception, un
   transfert ou une vente voyait la ligne mais **son stock ne bougeait pas**.

### ⚠️ Fausse piste — ne pas la refaire

J'ai d'abord cru que `updatedAt` n'était jamais bumpé (les `update()` des services font
`.set(data)` sans y toucher). **C'est faux** : `electron/db/migrations.ts` définit
**7 triggers SQLite `AFTER UPDATE`** qui bumpent `updated_at` sur warehouses, products,
suppliers, customers, purchase_orders et sales. Les « corrections » correspondantes ont
été annulées. Les tables **sans** trigger : receptions, reception_items,
purchase_order_items, transfers, transfer_items, order_payments, sale_items,
sale_payments, stock_movements, carton_size_compositions.
`ReceptionService.update` a son bump manuel explicite. **Toute nouvelle table
synchronisable doit avoir l'un ou l'autre.**

## ✅ Fait, testé, poussé

| | |
|---|---|
| API — commit | `2c1e1dc` sur `main`, **CI verte, DÉPLOYÉE en prod** |
| Desktop — commit | `c1a4084` sur `main`, poussé, **PAS ENCORE TAGGUÉ** |

**API** : 3 tables de ventes (migration `..._000014_create_sales_tables`, déjà exécutée
en prod), modèles `Sale`/`SaleItem`/`SalePayment`, `SaleController` complet (index, show,
store, update, destroy, addPayment, deletePayment) avec génération des mouvements de
stock en effet de bord ; `index()` en `withTrashed()` sur warehouses, products,
customers, suppliers, purchase-orders ; unicité de `sales.reference` en **index partiel
`WHERE deleted_at IS NULL`**.

**Desktop** (`electron/services/sync.service.ts` uniquement) : `syncSales` (en-tête +
lignes + règlements, règlements tardifs poussés un par un) ; drapeau **`canDelete`** pour
propager les suppressions des 6 entités supprimables ; **rejeu local des mouvements de
stock au pull** (`replayReceptionMovements`, `replayTransferMovements`,
`replaySaleMovements`, `replaySaleCancellation`), idempotent via `hasMovementsFor`.

### Niveau de vérification

- `tsc --noEmit` exit 0 + `vite build` complet (renderer + main + preload)
- `php -l` sur les 11 fichiers PHP ; 7 routes `sales` actives ; migration passée en prod
- **16 assertions HTTP** bout-en-bout sur la vraie API
- **21 assertions** d'un banc « deux postes » : 2 vraies bases SQLite ↔ vraie API Laravel
- Le même banc sur le code d'avant **échoue 11 fois** → le test n'est pas complaisant
- Données de recette purgées, prod revenue à son état initial, jeton de test révoqué
- ❌ **UI jamais exercée** (pas d'Electron sur le serveur de dev) — angle mort habituel

## ⏳ Ce qui bloque

**Franck doit envoyer les deux fichiers `stockpilot.db`.** Les données sont sur deux
machines Windows inaccessibles depuis le serveur. Sur chaque poste : bouton
**Sauvegarder** de l'app (`backup:save`, simple copie du fichier), puis déposer les deux
fichiers sur le serveur.

## Ordre impératif de la suite

1. ⏳ Récupérer les 2 `.db`.
2. **Inspecter** puis **fusionner** hors-ligne avec `/home/admin/stockpilot-fusion/fusion.mjs`
   (voir le README de ce dossier).
3. Restaurer la base fusionnée sur les deux postes (bouton **Restaurer**, `backup:restore`).
4. **Seulement ensuite**, tagger une version → l'auto-update fait le reste.

> ⚠️ **Ne pas activer la synchro sur les deux postes avant la fusion.** Les deux bases ont
> divergé séparément : si un même produit ou une même vente y existe avec la même
> référence mais des UUID différents, le second push heurtera l'index unique de l'API
> (500). C'est précisément ce que `fusion.mjs inspect` détecte avant qu'il soit trop tard.

## Questions ouvertes

- **Quelle version tourne sur chaque poste ?** À lire dans l'app. Un poste en ≤1.3.1
  cumule aussi le bug de l'avance qui ressuscite.
- **La synchro est-elle configurée sur l'un des deux postes ?** (indicateur `SyncStatus`
  dans le bandeau du haut). La base en ligne vide suggère que non, mais ce n'est pas prouvé.
- Limite laissée telle quelle : `order_payments` est **supprimé en dur** côté API (pas de
  `SoftDeletes` sur le modèle, pas de colonne `deleted_at`), donc la suppression d'un
  paiement de commande ne redescend pas vers le second poste.
