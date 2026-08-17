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
| Desktop — synchro | `c1a4084` sur `main`, poussé, **PAS ENCORE TAGGUÉ** |
| Desktop — sauvegarde WAL | `b8039a8` sur `main` |
| Outil de fusion | `/home/admin/stockpilot-fusion/` (hors dépôt) |

### 🐞 Découverte en préparant la fusion : les sauvegardes pouvaient être VIDES

`backup:save` faisait `fs.copyFileSync(getDbPath(), ...)`. Or la base tourne en
`journal_mode = WAL` : tout ce qui n'a pas encore été basculé depuis `stockpilot.db-wal`
**manque à la sauvegarde**. Cas réellement rencontré ici : fichier principal de 4 Ko,
WAL de 873 Ko → sauvegarde obtenue à **0 table**.

`backup:restore` était pire : il écrasait `stockpilot.db` pendant que l'app la tenait
ouverte, en laissant les `-wal`/`-shm` de l'**ancienne** base, que SQLite réapplique au
redémarrage par-dessus la nouvelle.

Corrigé en `b8039a8` : `.backup()` (API de sauvegarde en ligne de SQLite) à l'écriture,
fermeture + suppression des fichiers annexes à la restauration, refus d'un fichier qui
n'est pas une base StockPilot, et mise de côté de l'ancienne base en
`stockpilot.db.avant-restauration`. Vérifié sur le cas réel : 0 table → 17 tables,
données complètes, `integrity_check` ok, sans aucun fichier annexe.

> ⚠️ **Conséquence directe : les deux `.db` doivent être exportés depuis une version
> ≥ 1.4.0**, sinon ils risquent d'être incomplets. Avec une version antérieure, copier
> **les trois** fichiers (`stockpilot.db`, `-wal`, `-shm`) depuis `userData`.

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

## 🌐 L'infrastructure en ligne est saine (vérifié le 17/08)

Le réseau n'a **jamais** été le problème — il ne faut pas repartir sur cette piste.

- `https://stockpilot.feujio.com` → **HTTP 200**, certificat Let's Encrypt valide
  jusqu'au **19 octobre 2026**, redirection HTTP→HTTPS.
- Le bloc serveur est **dans `/etc/nginx/sites-enabled/feujio.com`** (pas de fichier
  `stockpilot` séparé — un `grep` naïf ne le trouve pas, et sans `sudo` il échoue en
  silence). Il proxifie vers `127.0.0.1:8090`.
- `/api/v1/sales`, `/purchase-orders`, `/products` répondent **401** (route vivante et
  protégée) et non 404.
- L'URL par défaut compilée dans l'app (`DEFAULT_API_URL` dans `sync-config.service.ts`)
  est précisément `https://stockpilot.feujio.com`. Elle est donc correcte.
- IP publique : `187.124.71.140`, toujours celle du secret `DEPLOY_HOST`.

**Conclusion : si la base en ligne est vide, c'est que la synchro n'a jamais été activée
sur aucun des deux postes.** Elle exige une connexion (email + mot de passe) pour obtenir
le jeton Sanctum stocké dans `userData/sync-config.json` ; sans ce fichier, `runSync`
sort immédiatement sur `not_configured`.

## ⏳ Ce qui bloque

**Franck doit envoyer les deux fichiers `stockpilot.db`.** Les données sont sur deux
machines Windows inaccessibles depuis le serveur. Sur chaque poste : bouton
**Sauvegarder** de l'app (`backup:save`, simple copie du fichier), puis déposer les deux
fichiers sur le serveur.

## Ordre impératif de la suite

1. ⏳ Récupérer les 2 `.db` (voir l'avertissement WAL ci-dessus).
2. **Inspecter** puis **fusionner** avec `/home/admin/stockpilot-fusion/fusion.mjs`
   — outil **écrit et testé**, voir le README de ce dossier.
3. Restaurer la base fusionnée sur les deux postes (bouton **Restaurer**).
4. **Seulement ensuite**, tagger une version → l'auto-update fait le reste.

### L'outil de fusion est prêt

`/home/admin/stockpilot-fusion/` — `fusion.mjs inspect` (ne modifie rien, signale les
collisions de référence à trancher à la main) et `fusion.mjs merge` (union, dernière
écriture gagne, aucune suppression). Testé de bout en bout sur deux bases réellement
divergentes : `integrity_check` ok, 0 violation de clé étrangère.

⚠️ Piège trouvé au test : **`stock_movements` ne se fusionne pas par UUID.** Chaque poste
génère ses propres lignes pour un même événement réel (4 sur A, 4 sur B pour la même
vente) — une union naïve **doublerait le stock**. L'outil raisonne par `reference_id` :
si A a déjà des mouvements pour cette référence, les siens font foi. Les mouvements sans
référence (ajustements manuels) se fusionnent normalement. Vérifié : stock net identique
avant et après fusion.

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
