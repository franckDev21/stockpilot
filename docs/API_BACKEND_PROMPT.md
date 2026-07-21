# StockPilot — Prompt de création de l'API backend

> **Comment utiliser ce fichier** : copie-colle l'intégralité de ce document comme prompt à un assistant IA (ou donne-le à un développeur) sur ton serveur de production. Il décrit le projet StockPilot, son modèle de données exact et **tous les endpoints REST** dont l'application desktop a besoin pour sauvegarder ses données en ligne.

---

## 1. Contexte du projet

**StockPilot** est un logiciel de **gestion de stock de chaussures** (application desktop Electron + React + TypeScript), destiné au marché camerounais. Les montants sont en **FCFA**.

Aujourd'hui, les données sont stockées **localement** dans une base **SQLite** (via Drizzle ORM). Objectif : créer une **API REST** hébergée sur un serveur afin de **centraliser et sauvegarder les données en ligne**, pour :

- sauvegarder les données hors de la machine locale,
- permettre à terme plusieurs postes / boutiques de partager les mêmes données,
- consulter les données depuis le web.

L'application gère : produits (modèles de chaussures), fournisseurs, clients, boutiques/entrepôts, commandes fournisseur (avec paiements échelonnés), réceptions, transferts entre entrepôts, mouvements de stock, et statistiques.

### Concepts métier clés

- Un **produit** représente un modèle de chaussure. Il se vend au **carton** (un carton contient N **paires**, `pairsPerCarton`, souvent 12).
- Une **commande fournisseur** (`purchase_order`) regroupe plusieurs **lignes** (`purchase_order_items`), une ligne = un produit avec un nombre de cartons.
- Une commande peut avoir **plusieurs paiements** (`order_payments`) : des avances (`deposit`), un solde (`balance`) ou un paiement intégral (`full`). La **dette fournisseur** = `totalCostFcfa − somme des paiements`.
- La table **`stock_movements` est la SOURCE DE VÉRITÉ du stock** : chaque entrée/sortie (réception, transfert, ajustement, perte) y est enregistrée avec une quantité signée (`+` entrée, `−` sortie). Le stock courant d'un produit = somme des quantités.
- **Tout l'argent est en entiers FCFA** (jamais de float pour la monnaie).
- **Soft delete** : les entités principales ont un champ `deletedAt` (nul = actif). Une suppression met à jour `deletedAt` au lieu d'effacer la ligne.

> ⚠️ Les tables `sales`, `sale_items`, `sale_payments` existent dans le schéma historique mais **le module Ventes a été retiré de l'application**. Tu peux les inclure pour compatibilité future ou les ignorer.

---

## 2. Stack recommandée pour l'API

Libre à toi, mais recommandation cohérente avec l'existant :

- **Node.js + TypeScript** (le desktop est déjà en TS, types réutilisables).
- Framework : **Express** ou **Fastify** (ou NestJS si tu veux une structure forte).
- Base de données : **PostgreSQL** (recommandé en production) ou MySQL.
- ORM : **Drizzle ORM** (déjà utilisé côté desktop) ou **Prisma**.
- Auth : **JWT** (Bearer token) — voir §5.
- Validation : **Zod**.
- Réponses **JSON**, dates au format **ISO 8601** (`YYYY-MM-DD` pour les dates métier, timestamp ISO pour `createdAt/updatedAt`).

### Conventions générales

- Tous les identifiants (`id`) sont des **UUID (string)**, générés côté serveur si absents.
- Les montants sont des **entiers** (FCFA).
- Les booléens : vrais booléens JSON.
- Réponses d'erreur : `{ "error": "message lisible", "details"?: ... }` avec le bon code HTTP (400, 401, 404, 409, 422, 500).
- Pagination optionnelle : `?page=1&limit=50` renvoyant `{ data: [...], total, page, limit }`. Par défaut, renvoyer toutes les lignes actives.
- Filtrer par défaut les lignes avec `deletedAt = null` (sauf paramètre `?includeDeleted=true`).

---

## 3. Modèle de données (entités, champs, relations)

Types de champs : `uuid` (string), `string`, `text` (string long), `int` (entier), `bool`, `date` (`YYYY-MM-DD`), `enum`. Sauf mention, chaque table a aussi : `createdAt` (timestamp ISO), `updatedAt` (timestamp ISO), `deletedAt` (timestamp ISO nullable).

### 3.1 `warehouses` — Entrepôts & boutiques
| champ | type | notes |
|---|---|---|
| id | uuid | PK |
| name | string | requis |
| type | enum(`warehouse`,`boutique`) | défaut `boutique` |
| address | string? | |
| isDefault | bool | défaut `false` |

### 3.2 `products` — Produits (modèles de chaussures)
| champ | type | notes |
|---|---|---|
| id | uuid | PK |
| reference | string | **unique**, requis |
| name | string | requis |
| brand | string? | |
| category | string? | |
| description | text? | |
| imageData | text? | **une ou plusieurs images en Data URI base64**, sérialisées en JSON (`["data:image/png;base64,...", ...]`). Peut être volumineux. |
| pairsPerCarton | int | défaut 12 |
| alertThreshold | int | défaut 0 (seuil d'alerte stock bas, en cartons) |
| sellingPricePerCarton | int | FCFA, défaut 0 |

> Note stockage image : `imageData` peut peser plusieurs centaines de Ko. En PostgreSQL, un `text`/`bytea` convient. Prévois une limite de taille de requête suffisante (ex. 10–15 Mo) ou, mieux, un endpoint d'upload d'image séparé stockant les fichiers (S3/disque) et ne gardant qu'une URL.

### 3.3 `suppliers` — Fournisseurs
| champ | type |
|---|---|
| id | uuid (PK) |
| name | string (requis) |
| country, city, phone, email, whatsapp, address, notes | string? |

### 3.4 `customers` — Clients
| champ | type | notes |
|---|---|---|
| id | uuid | PK |
| name | string | requis |
| phone, email, whatsapp, address, notes | string? | |
| type | enum(`wholesale`,`retail`) | défaut `wholesale` |

### 3.5 `purchase_orders` — Commandes fournisseur
| champ | type | notes |
|---|---|---|
| id | uuid | PK |
| reference | string | **unique**, requis (ex. `CMD-2026-001`) |
| supplierId | uuid | FK → suppliers |
| orderDate | date | requis |
| expectedDeliveryDate | date? | |
| status | enum(`draft`,`confirmed`,`partial`,`complete`,`cancelled`) | défaut `confirmed` |
| productCostFcfa | int | défaut 0 |
| freightCostFcfa | int | défaut 0 (transport) |
| customsCostFcfa | int | défaut 0 (douane) |
| otherCostsFcfa | int | défaut 0 |
| totalCostFcfa | int | défaut 0 (**coût total** de la commande) |
| simulatedSalePricePerCartonFcfa | int? | simulation de rentabilité |
| notes | text? | |

### 3.6 `purchase_order_items` — Lignes de commande
| champ | type | notes |
|---|---|---|
| id | uuid | PK |
| orderId | uuid | FK → purchase_orders |
| productId | uuid | FK → products |
| cartonsOrdered | int | requis |
| pairsPerCarton | int | requis |
| unitCostPerCartonFcfa | int | requis (coût d'achat d'un carton) |
| notes | text? | |

### 3.7 `carton_size_compositions` — Répartition des pointures d'un carton
| champ | type | notes |
|---|---|---|
| id | uuid | PK |
| orderItemId | uuid | FK → purchase_order_items |
| size | string | ex. `"38"`, `"39"` |
| pairsCount | int | nb de paires de cette pointure |

*(pas de `createdAt/updatedAt/deletedAt` sur cette table)*

### 3.8 `order_payments` — Paiements fournisseur
| champ | type | notes |
|---|---|---|
| id | uuid | PK |
| orderId | uuid | FK → purchase_orders |
| amountFcfa | int | requis |
| paymentDate | date | requis |
| type | enum(`deposit`,`balance`,`full`) | requis (avance / solde / intégral) |
| notes | text? | |

### 3.9 `receptions` + `reception_items` — Réception fournisseur → entrepôt
`receptions` : id, `orderId` (FK purchase_orders), `warehouseId` (FK warehouses), `receptionDate` (date), notes.
`reception_items` : id, `receptionId` (FK receptions), `orderItemId` (FK purchase_order_items), `cartonsReceived` (int).

> **Effet métier** : une réception génère des `stock_movements` de type `reception` (entrées positives) dans l'entrepôt de destination.

### 3.10 `transfers` + `transfer_items` — Transfert entrepôt → boutique
`transfers` : id, `fromWarehouseId` (FK), `toWarehouseId` (FK), `transferDate` (date), notes.
`transfer_items` : id, `transferId` (FK), `productId` (FK), `size` (string), `pairsCount` (int).

> **Effet métier** : un transfert génère 2 mouvements par ligne — `transfer_out` (négatif) depuis l'origine, `transfer_in` (positif) vers la destination.

### 3.11 `stock_movements` — SOURCE DE VÉRITÉ du stock
| champ | type | notes |
|---|---|---|
| id | uuid | PK |
| productId | uuid | FK → products |
| warehouseId | uuid | FK → warehouses |
| size | string | pointure |
| quantity | int | **signé** : + entrée, − sortie |
| movementType | enum(`reception`,`transfer_in`,`transfer_out`,`sale`,`adjustment`,`loss`) | |
| referenceId | uuid? | id de la réception/transfert à l'origine |
| referenceType | string? | `reception` \| `transfer` \| `sale` |
| unitCostFcfa | int? | coût par paire à l'entrée |
| movementDate | date | requis |
| notes | text? | |

### 3.12 (Optionnel / historique) `sales`, `sale_items`, `sale_payments`
Module Ventes retiré de l'app. Schéma disponible sur demande si tu veux le prévoir (structure symétrique aux commandes : `sales` avec `customerId`, `warehouseId`, `saleDate`, `saleType` wholesale/retail, `totalAmountFcfa`, `paidAmountFcfa`, `status` pending/partial/paid ; `sale_items` ; `sale_payments`).

---

## 4. Endpoints REST à implémenter

Base URL suggérée : `/api/v1`. Toutes les routes (sauf `/auth/login`) exigent un **Bearer token** (§5).

### 4.1 Auth
- `POST /auth/login` → body `{ email, password }` → `{ token, user: { email } }` (401 si invalide).
- `GET  /auth/me` → `{ email }` (vérifie le token).
- `POST /auth/logout` → `{ success: true }` (optionnel : invalider le token).

### 4.2 Ressources CRUD standard
Pour **chaque** ressource ci-dessous, exposer :
- `GET    /{ressource}` — liste (actifs uniquement)
- `GET    /{ressource}/{id}` — détail
- `POST   /{ressource}` — création (renvoie l'entité créée avec son `id`)
- `PATCH  /{ressource}/{id}` — mise à jour partielle
- `DELETE /{ressource}/{id}` — soft delete (`deletedAt = now`)

Ressources : `warehouses`, `products`, `suppliers`, `customers`, `purchase-orders`, `transfers`, `receptions`.

### 4.3 Endpoints spécifiques (mapping direct des besoins de l'app desktop)

**Produits**
- `GET /products/{id}/stock?warehouseId=` — stock courant du produit (agrégé depuis `stock_movements`), optionnellement filtré par entrepôt.
- `GET /products/{id}/carton-stats` → `{ totalCartons, totalPairsFromCartons }`.

**Clients**
- `GET /customers/{id}/balance` — solde/créance du client.

**Commandes fournisseur**
- `GET  /purchase-orders/enriched` — **liste enrichie** : chaque commande avec `supplierName`, coordonnées fournisseur (`supplierPhone`, `supplierWhatsapp`, `supplierEmail`, `supplierCountry`, `supplierCity`, `supplierAddress`), ses `items` (avec `productName`, `productReference`, `productImageData`, `cartonsOrdered`, `pairsPerCarton`, `unitCostPerCartonFcfa`) et ses `payments`. **C'est l'endpoint principal du tableau des commandes.**
- `POST   /purchase-orders/{orderId}/payments` — ajouter un paiement `{ amountFcfa, type, paymentDate, notes? }`.
- `DELETE /purchase-orders/payments/{paymentId}` — supprimer un paiement.
- `POST   /purchase-orders/simulate-profit` — body de simulation → renvoie une projection de rentabilité (revenu, marge, coût par carton).

**Réceptions**
- `GET  /receptions/enriched` — liste enrichie (avec noms produits/entrepôts).
- `POST /receptions` — créer une réception ; **doit générer les `stock_movements`** correspondants (type `reception`).

**Transferts**
- `POST /transfers` — créer un transfert ; **doit générer les `stock_movements`** `transfer_out` + `transfer_in`.

**Stock**
- `GET /stock/current?warehouseId=` — stock courant agrégé (par produit/pointure/entrepôt).
- `GET /stock/movements?productId=&warehouseId=` — historique des mouvements d'un produit.
- `GET /stock/low` — produits sous leur `alertThreshold` → `[{ productId, productName, reference, totalPairs, threshold }]`.

**Statistiques (dashboard)**
- `GET /stats/dashboard` → `{ caToday, caThisMonth, caLastMonth, totalReceivables, pendingOrdersCount, totalStockPairs }` (adapter aux champs réellement affichés).
- `GET /stats/supplier-payables` → `[{ orderId, reference, supplierName, orderDate, totalCostFcfa, paidAmountFcfa }]` — **commandes avec un solde dû** (utilisé pour "Ce que je dois à mes fournisseurs").
- `GET /stats/top-products?...`
- `GET /stats/stock-forecast`
- `GET /stats/sales-timeline?days=30` *(si module ventes réactivé)*
- `GET /stats/receivables` *(si module ventes réactivé)*

### 4.4 Maintenance (optionnel mais utile)
- `POST /admin/reset` — vider toutes les données (protégé, pour environnement de test).
- `GET  /admin/export` / `POST /admin/import` — sauvegarde/restauration complète (JSON).

---

## 5. Authentification

- **Un seul compte admin** au départ (comme le desktop). Stocker email + hash du mot de passe (bcrypt/argon2) en variables d'environnement ou en base.
- `POST /auth/login` vérifie les identifiants et renvoie un **JWT** signé (durée ex. 30 jours).
- Toutes les autres routes exigent l'en-tête `Authorization: Bearer <token>`.
- Prévoir une variable d'env `JWT_SECRET`.

Identifiants de développement actuels du desktop (à répliquer / remplacer) :
```
email    : feujiodoungue@gmail.com
password : password
```
> ⚠️ En production, **change ce mot de passe** et stocke un hash, jamais en clair.

---

## 6. Règles métier à respecter côté serveur

1. **Stock = somme des `stock_movements`** (jamais un champ « quantité » figé sur le produit).
2. **Réception** → créer les mouvements `reception` (positifs) dans l'entrepôt cible.
3. **Transfert** → créer `transfer_out` (négatif, origine) + `transfer_in` (positif, destination), de manière atomique (transaction).
4. **Dette d'une commande** = `totalCostFcfa − Σ payments.amountFcfa` ; `status` peut être recalculé (`complete`/`partial`) selon les paiements.
5. **Montants** : entiers FCFA, jamais de float.
6. **Soft delete** partout (`deletedAt`). Ne pas casser les FK en supprimant physiquement.
7. **Références uniques** : `products.reference`, `purchase_orders.reference` doivent être uniques (409 en cas de doublon).
8. Toute création multi-tables (commande + lignes + compositions, réception + items + mouvements) doit être **transactionnelle**.

---

## 7. Livrables attendus

1. Le code de l'API (structure claire, TypeScript).
2. Le **schéma de base de données** (migrations).
3. Un fichier **`.env.example`** (`DATABASE_URL`, `JWT_SECRET`, `PORT`, identifiants admin…).
4. Un **README** : installation, migrations, lancement, déploiement.
5. Une **collection de tests** (ou fichier `.http` / Postman) couvrant les endpoints principaux.
6. (Bonus) Un endpoint `GET /health` pour le monitoring.

---

## 8. Pour l'intégration côté application desktop (info)

L'app desktop appellera cette API à la place (ou en complément) de sa base SQLite locale. Prévois donc :
- **CORS** ouvert pour l'app (ou requêtes serveur-à-serveur).
- Des réponses JSON dont la **forme correspond exactement** aux entités décrites en §3 (mêmes noms de champs, en `camelCase`).
- Idéalement, un **timestamp `updatedAt`** fiable sur chaque entité pour permettre une future **synchronisation incrémentale** (offline-first : l'app garde SQLite en local et pousse/pull les changements).
```
