# Synchronisation des deux postes — suivi

**Démarré le 2026-08-17.** Fichier de reprise : si la session est coupée, tout ce qu'il
faut savoir pour continuer est ici.

---

## 📌 POINT DE REPRISE — 18/08/2026 (soir) — LIRE EN PREMIER

### En une phrase

Les deux postes se synchronisent désormais **tout seuls**, dans les deux sens, **sans
qu'on ait à saisir quoi que ce soit** : l'application embarque un jeton dédié et parle à
deux points d'entrée en bloc, `POST /sync/push` et `GET /sync/pull`.

### Ce que Franck a demandé (18/08 au soir)

> « Les versions ne se synchronisent pas ! Je veux un bouton qui permet de soumettre la
> version la plus à jour sur le serveur, en deux clics maxi, sans mot de passe. […] Sur
> l'ordinateur B, je clique sur un bouton synchroniser et ça met ce poste à jour comme
> l'ordinateur A. Et je voudrais que la synchronisation des deux appareils se fasse
> automatiquement. »

Le bouton « Envoyer au serveur » de la 1.5.0 **réclamait des identifiants** — d'où
l'agacement. La 1.6.0 avait déjà réglé ce point (jeton embarqué, secret GitHub posé à
13:50, build du tag à 13:53), mais elle n'envoyait que le **fichier** de base, pour une
fusion manuelle de ma part. Ce n'était pas ce qu'il voulait : il veut que les données
circulent, pas des fichiers.

### Ce qui a été livré

**API** (commit `468db4b`, CI + déploiement verts, routes vivantes en prod) :

| Point d'entrée | Rôle | Ability |
|---|---|---|
| `POST /api/v1/sync/push` | le poste dépose tout ce qu'il a | `sync:push` |
| `GET /api/v1/sync/pull?entity=…` | ce que le serveur a, tombstones compris | `sync:pull` |

- clé = l'UUID du poste ; **dernière écriture gagne** ; **les horodatages du poste sont
  conservés** — les remplacer par `now()` ferait croire au poste que le serveur est plus
  récent que lui, et il re-tirerait ses propres données au pull suivant ;
- **une transaction par ligne** : une référence en double n'emporte pas les milliers
  d'autres, elle est *signalée au poste* (« référence déjà utilisée… ») ;
- **les mouvements de stock ne sont jamais transportés** : le serveur les rejoue à partir
  de la réception / du transfert / de la vente, et seulement si cette référence n'en a pas
  déjà. Sans ce garde-fou, renvoyer deux fois le même lot **doublait le stock** ;
- abilities volontairement **étroites** : le dépôt desktop est public (condition de
  l'auto-update), donc le jeton voyage dans un binaire téléchargeable. Un jeton d'envoi ne
  peut rien lire, un jeton de lecture ne peut rien écrire, et **ni l'un ni l'autre
  n'atteint les bases déposées par les autres postes**.

**Desktop** (version **1.7.0**) :

- bouton « Envoyer au serveur » → modale « Envoyer mes données au serveur » : un écran de
  confirmation, une barre de progression, puis le détail *ajoutées / à jour / déjà à jour*
  par entité et la liste des lignes refusées. L'envoi du **fichier** de base reste
  accessible depuis la même fenêtre (« Envoyer plutôt le fichier de base ») ;
- « Synchroniser maintenant » (indicateur du bandeau) et la **synchro automatique toutes
  les 3 minutes** passent par ces mêmes points d'entrée quand le poste n'a pas de
  configuration : plus rien à saisir, et l'indicateur n'affiche plus « Non configuré » ;
- la synchro automatique est **incrémentale** (`updated_at > dernière synchro`) : sans ça
  elle réexpédierait toute la base, photos produit comprises, toutes les 3 minutes. Une
  commande ou une vente repart dès qu'**une de ses lignes** a bougé — un règlement ajouté
  après coup ne touche pas toujours l'en-tête. Le bouton, lui, envoie **tout** ;
- l'horodatage de dernière synchro n'avance **que si tout est passé**, sinon la synchro
  incrémentale suivante sauterait ce qui vient d'échouer.

### Niveau de vérification

| Ce qui est prouvé | Comment |
|---|---|
| L'API fait ce qu'elle annonce | **22 tests, 73 assertions** (dont les 9 préexistants) |
| Le **vrai code client** tourne | **banc deux postes headless, 27 assertions vertes** : 2 vraies bases SQLite ↔ une vraie API Laravel |
| Le stock ne double pas | re-synchro complète du poste B : stock identique (54 paires) |
| Une vente saisie sur B arrive sur A | et le stock de A suit (54 → 52) |
| Une suppression circule | B voit la vente supprimée sur A |
| L'incrémental n'oublie rien | un règlement tardif fait repartir sa vente, et rien d'autre |
| Les abilities tiennent **en production** | `sync:pull` → 200 sur le bundle, **403** sur `/products` et sur `/backups` |
| ❌ L'UI n'a jamais été cliquée | pas d'Electron sur ce serveur — limitation permanente |

### À faire à la reprise

1. **Installer la 1.7.0 sur les deux postes.** ⚠️ Un poste qui redemande un mot de passe
   est un poste **resté sur une ancienne version** : la mise à jour ne s'applique qu'au
   redémarrage de l'application.
2. Sur le poste à jour (A) : « Envoyer au serveur » → « Confirmer l'envoi ».
3. Sur le poste en retard (B) : cliquer sur l'indicateur de synchro → « Synchroniser
   maintenant ». Ensuite, plus rien à faire : les deux postes se recalent seuls.
4. Vérifier côté serveur : `docker compose exec postgres psql -U stockpilot -d stockpilot
   -c "select count(*) from sales;"` — 0 avant, non nul après.
5. Si des lignes sont **refusées** pour « référence déjà utilisée » : c'est le cas que la
   machine ne peut pas trancher (les deux postes ont créé « CMD-003 » chacun de leur
   côté). Utiliser `/home/admin/stockpilot-fusion/fusion.mjs inspect` sur les deux bases
   pour décider qui garde quelle référence.

## POINT DE REPRISE PRÉCÉDENT — 18/08/2026 (matin)

### Où on en est en une phrase

Le bouton « Envoyer au serveur » **envoie désormais en deux clics, sans mot de passe** :
l'app embarque un jeton dédié. Le blocage constaté ce matin — quatre `POST /auth/login`
en **401** depuis un poste — est levé à la racine, puisqu'il n'y a plus d'identifiants à
saisir. Publié en **v1.6.0**.

### Ce qui s'est passé le 18/08 au matin (diagnostic, pas supposition)

Le journal nginx public montre **4 tentatives de connexion à 15:36–15:38 depuis
`143.105.152.254`** (la même machine Windows qui utilise admin.feujio.com), User-Agent
`node` — donc bien l'app de bureau, pas un navigateur. **401 les quatre fois.**

Cause : `AuthController::login` ne renvoie 401 que dans un seul cas, **email inconnu ou
mot de passe faux** (un email mal formé donnerait 422). Or il n'existait qu'**un seul
compte** sur le serveur, `feujiodoungue@gmail.com`, dont le mot de passe date du 21/07.

⚠️ Ce que ces 401 prouvent au passage, et c'est une bonne nouvelle : la modale s'ouvre,
la requête part et atteint le serveur. `uploadDatabase()` **s'exécute** — l'angle mort
runtime du 17/08 portait donc bien sur l'authentification, pas sur le reste.

### Ce qui a été livré le 18/08

**API** (commit `7cce5ff`, CI + déploiement verts) : `EnforceTokenAbilities` accepte une
ability **étroite**, `backups:upload`, valable pour le seul `POST /api/v1/backups`.

Pourquoi pas simplement l'ability `write` : le jeton voyage **dans l'exécutable
distribué**, et le dépôt desktop est public. Un jeton `write` diffuserait un droit
d'écriture sur toute l'API. Un jeton `backups:upload` est refusé partout ailleurs, **y
compris pour lister, télécharger ou supprimer les bases déjà déposées** — qui contiennent
les données des autres postes.

**Compte dédié** créé en production : `postes@stockpilot.feujio.com` (user `id=3`),
porteur du seul jeton `poste-upload` / `['backups:upload']`, sans expiration. Le compte
admin `feujiodoungue@gmail.com` n'a **pas** été touché.

**Desktop** : jeton injecté **au build** via le secret GitHub `STOCKPILOT_UPLOAD_TOKEN`
(jamais dans le dépôt, qui est public). Ordre d'authentification :
identifiants saisis > configuration de synchro > jeton embarqué. Les identifiants passent
**devant** exprès : c'est la porte de secours si le jeton était révoqué. Le nom du poste
vient de `os.hostname()`, la modale n'est plus qu'un écran de confirmation.

### Niveau de vérification

| Ce qui est prouvé | Comment |
|---|---|
| Le jeton dépose une base | **201** contre la production publique |
| Il ne peut pas lister les bases | **403** `lacks the 'read' ability` |
| Il ne peut pas écrire ailleurs | **403** sur `POST /warehouses` |
| Les abilities tiennent en test | **9 tests, 22 assertions, 0 échec** |
| Le jeton atterrit dans le bundle | sentinelle retrouvée dans `dist-electron/main.js` |
| `uploadDatabase()` **s'exécute** | banc headless : `{"success":true}` — **première exécution réelle** |
| La base reçue est complète | 500 lignes, somme 12 525 000, `integrity_check` **ok** |
| Le WAL est bien capturé | la base de test avait son WAL non basculé |

❌ Toujours pas exercé : **l'UI réelle** (pas d'Electron sur ce serveur). Le banc appelle
`uploadDatabase()` directement, il ne clique pas sur le bouton.

### À faire à la reprise

1. **Franck installe la 1.6.0** (auto-update) et clique « Envoyer au serveur » sur les
   **deux** postes. Plus rien à saisir : ouvrir, confirmer.
2. Vérifier l'arrivée : `ls /home/admin/stockpilot-api/storage/app/private/backups/`.
3. `fusion.mjs inspect` sur les deux bases, puis fusion **ou** simple activation de la
   synchro s'il n'y a aucune collision de référence.

⚠️ Toujours valable : **ne pas activer la synchro sur les deux postes avant d'avoir
tranché les collisions.**

---

## POINT DE REPRISE PRÉCÉDENT — 17/08/2026, fin de session

### Où on en est en une phrase

Tout ce qui dépend du serveur est **fait, testé et en production**. Le sujet de fond — la
fusion des deux bases — **n'a pas avancé d'un pouce**, parce qu'il attend deux fichiers
qui sont sur des machines Windows inaccessibles depuis ce serveur.

### État vérifié (dernière mesure de la session)

| | |
|---|---|
| Dépôt desktop | propre, `main` = `origin/main`, dernier commit `2061d23`, version **1.5.0** |
| Dépôt API | propre, `main` = `origin/main`, dernier commit `e5f26f9` |
| API en production | `https://stockpilot.feujio.com` → health **200**, `/backups` **401**, `/sales` **401** |
| Release publiée | **v1.5.0** — `latest.yml` → **200** / `version: 1.5.0`, `.exe` → **206** (anonyme) |
| Base de production | **0 base reçue, 0 vente, 0 commande, 0 jeton client** |

**Traduction de la dernière ligne : aucun poste ne s'est jamais connecté.** Ni synchro
activée, ni base envoyée. Les données du client sont encore uniquement sur ses deux
machines.

### Les 3 choses à faire à la reprise, dans cet ordre

1. **Demander à Franck où en sont les postes** : affichent-ils **1.5.0** après redémarrage
   complet ? Le bouton « Envoyer au serveur » a-t-il été essayé, et qu'a-t-il donné ?
2. **Récupérer les deux bases** — par le nouveau bouton, ou par `scp` vers
   `/home/admin/stockpilot-fusion/bases/` (`posteA.db` = bureau, `posteB.db` = portable).
3. **Inspecter puis fusionner** avec `/home/admin/stockpilot-fusion/fusion.mjs`.
   Si l'inspection ne signale **aucune collision de référence**, la fusion hors-ligne
   devient inutile : il suffit d'activer la synchro sur les deux postes et ils
   convergeront seuls. Sinon, fusionner puis restaurer.

### Le piège à ne pas réintroduire

**Ne pas activer la synchro sur les deux postes avant que la fusion soit tranchée.** Les
bases ont divergé séparément : un même produit ou une même vente peut y porter la même
référence avec un identifiant différent. Le second poste qui synchroniserait se prendrait
une **500** sur l'index unique — sans perte de données, mais avec une synchro incomplète
et des erreurs illisibles.

### L'angle mort assumé

`uploadDatabase()` (le bouton « Envoyer au serveur ») **n'a jamais été exécuté** : le banc
de test est tombé sur un blocage de session. Typechecké et compilé, rien de plus. C'est le
seul livrable de la journée dans ce cas. Si ça plante côté client : console de l'app
(`Ctrl+Shift+I`), scénario **S9** de [`MISE_EN_LIGNE.md`](./MISE_EN_LIGNE.md), et repli sur
le bouton **Sauvegarder**, lui éprouvé.

Plus généralement, **aucune interface n'est jamais exercée** sur ce serveur : pas
d'Electron. Tout ce qui est affirmé ici l'est au niveau des données et de l'API.

---

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
| Desktop — synchro | `c1a4084` sur `main` |
| Desktop — sauvegarde WAL | `b8039a8` sur `main` |
| **Release v1.4.0** | `213e49f`, tag `v1.4.0`, **PUBLIÉE le 17/08** — workflow vert |
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

## 🚀 v1.4.0 publiée le 17/08 — auto-update vérifié

Franck a demandé de publier pour que les deux postes reçoivent la mise à jour.

- Tag `v1.4.0` sur `213e49f`, workflow **Build & Release Windows** vert.
- Release **non-draft**, visible comme `Latest`.
- Chaîne d'auto-update vérifiée **en anonyme** (c'est ainsi qu'`electron-updater`
  l'interroge, et c'est ce qui avait piégé le projet quand le dépôt était privé) :
  `latest.yml` → **HTTP 200**, `version: 1.4.0` ; `StockPilot-Windows-1.4.0-Setup.exe`
  → **HTTP 206**, 95 673 137 octets.

> ⚠️ **Publier met à jour le LOGICIEL, pas les DONNÉES.** La synchro reste une action
> manuelle : il faut se connecter dans l'app pour qu'elle obtienne son jeton. Ne pas
> l'activer sur les deux postes avant que la fusion soit faite et restaurée — sinon
> chaque poste pousse ses données de son côté et on retombe sur les collisions de
> référence.

**Ce que la 1.4.0 débloque concrètement :** le bouton **Sauvegarder** fonctionne enfin
(correctif WAL). Franck peut donc envoyer les deux bases avec le bouton, sans avoir à
copier les trois fichiers à la main.

## 📤 Envoi de la base au serveur — LIVRÉ en v1.5.0 (17/08)

> ✅ **Tout est commité, poussé, déployé et publié.** API : `e5f26f9`, déploiement CI vert,
> health 200 et `/backups` → 401. Desktop : `8959db4` + `95ada2d`, tag **`v1.5.0`**,
> build Windows vert. Auto-update vérifié **en anonyme** : `latest.yml` → HTTP 200 /
> `version: 1.5.0`, `StockPilot-Windows-1.5.0-Setup.exe` → HTTP 206, 95 674 269 octets.
>
> ⚠️ **Reste l'angle mort** : `uploadDatabase()` n'a jamais tourné au runtime. À faire
> essayer sur un vrai poste dès l'installation de la 1.5.0 — voir le scénario **S9** de
> [`MISE_EN_LIGNE.md`](./MISE_EN_LIGNE.md). En secours, le bouton **Sauvegarder** (éprouvé).

### Détail (état au moment de l'écriture)

Franck a demandé une fonctionnalité qui envoie les bases au serveur automatiquement,
plutôt que par `scp` à la main.

**⚠️ RIEN N'EST COMMITÉ, dans aucun des deux dépôts.** Une protection de session a bloqué
toutes les commandes shell (y compris en lecture) avant que je puisse commiter. Reprendre
en mode d'autorisation par défaut, ou dans une session neuve.

**⚠️ Le plus urgent : côté API, le code est ACTIF EN PROD sans être commité** (bind mount
`.:/var/www/html`), et la migration `database_backups` **a déjà tourné**. Or le
déploiement fait un `git pull` — c'est exactement ce qui avait tout bloqué le 31/07.
Commiter l'API **en premier**.

Fichiers en attente — **API** : `database/migrations/2024_01_01_000015_create_database_backups_table.php`,
`app/Models/DatabaseBackup.php`, `app/Http/Controllers/DatabaseBackupController.php`,
`routes/api.php`, `docker/php/uploads.ini`, `docker/nginx/default.conf`, `docker-compose.yml`.
**Desktop** : `electron/services/backup-upload.service.ts`, `electron/handlers/backup.handler.ts`,
`electron/preload.ts`, `src/global.d.ts`, `src/components/layout/SendDatabaseModal.tsx`,
`src/components/layout/Header.tsx`, `MISE_EN_LIGNE.md`.

**Ce que ça fait** : bouton « Envoyer au serveur » dans le bandeau → modale (nom du poste)
→ `.backup()` puis envoi multipart vers `POST /api/v1/backups`. Le fichier atterrit dans
`storage/app/private/backups/` (monté en bind). Volontairement **découplé de la synchro** :
sans config, il demande les identifiants et obtient un jeton **sans le persister**, donc
envoyer sa base ne déclenche jamais la synchro périodique.

**Limites d'upload relevées** : PHP était à `upload_max_filesize=2M` / `post_max_size=8M`
— le vrai bloquant. Désormais 128M via `docker/php/uploads.ini` monté dans le conteneur.
Chaîne : nginx public **50M** (inchangé, fichier système hors dépôt) → nginx conteneur
128M → PHP 128M. **Le plafond effectif est donc 50 Mo.**

**Niveau de vérification** :
- ✅ **API prouvée** sur le domaine public : refus d'un non-SQLite (422), envoi (201),
  fichier arrivé **octet pour octet identique** (même sha256, `integrity_check` ok),
  liste, téléchargement conforme, suppression nettoyant fichier + enregistrement.
  Données de test purgées, compte et jetons de test supprimés.
- ⚠️ **Desktop : compilé et typechecké seulement.** `uploadDatabase()` n'a **jamais été
  exécuté** — le banc est tombé sur le blocage. C'est le point le plus fragile de la
  journée ; voir le scénario **S9** de [`MISE_EN_LIGNE.md`](./MISE_EN_LIGNE.md).

**Version à publier** : bumper en **1.5.0** (la 1.4.0 publiée ne contient pas ce bouton).

## 🧯 Procédure et pannes

Voir [`MISE_EN_LIGNE.md`](./MISE_EN_LIGNE.md) : ordre exact de mise en ligne avec les
vérifications, 16 scénarios d'échec (diagnostic + résolution), et les retours en arrière.

## ⏳ Ce qui bloque

**Franck doit envoyer les deux fichiers `stockpilot.db`.** Les données sont sur deux
machines Windows inaccessibles depuis le serveur. Sur chaque poste : bouton
**Sauvegarder** de l'app (`backup:save`, simple copie du fichier), puis déposer les deux
fichiers sur le serveur.

## Ordre impératif de la suite

1. ⏳ Récupérer les 2 `.db`. **Depuis la 1.4.0, le bouton Sauvegarder suffit** (une fois
   la mise à jour installée sur le poste). Sur un poste encore en 1.3.3, copier les trois
   fichiers à la main — voir l'avertissement WAL ci-dessus.
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

---

## 🔴 19/08/2026 — « la synchro ne marche que partiellement » : diagnostic

### Ce que Franck a constaté

1. Poste A → « Envoyer au serveur » : *tout est parti*. Poste B → « Synchroniser » :
   les commandes arrivent **mais leurs détails sont incomplets**.
2. Produit créé ensuite sur A : **jamais apparu sur B**.

### Ce qui est vérifié côté serveur (mesuré, pas supposé)

- Les deux postes parlent vraiment à l'API : `POST /sync/push` et `GET /sync/pull`
  **200** le 19/08 entre 13:31 et 13:36 depuis `143.105.152.71` (UA `node`).
- Le serveur porte bien les données du client : 32 produits, 24 commandes,
  34 lignes de commande, 5 fournisseurs, 3 entrepôts.
- Le produit `lv` (réf. `A237-17`, créé le 19/08 à 10:18) **EST sur le serveur**.
  Donc l'envoi depuis A a fonctionné : ce qui a échoué, c'est son application sur B.
- ⚠️ `carton_size_compositions` = **0 ligne** alors que 34 lignes de commande existent :
  les pointures ne sont jamais arrivées.
- `receptions`, `sales`, `stock_movements` = 0.
- Aucune erreur dans `laravel.log` depuis le 17/08 : les échecs sont **silencieux**.

### Cause n°1 — les lignes et pointures d'une commande sont traitées comme immuables

C'est l'explication des « détails incomplets ». Or dans l'application elles ne le sont
pas : `PurchaseOrderService.update()` modifie les lignes, supprime celles qu'on retire et
**remplace toutes les pointures par de nouveaux UUID à chaque modification**.

- **Poste receveur** — `sync.service.ts` `syncPurchaseOrders.applyRemoteToLocal()` :
  les lignes et pointures ne sont insérées que `if (isNew)`, c.-à-d. seulement si la
  commande était **totalement inconnue** du poste. Une commande déjà présente voit son
  en-tête mis à jour et **ses détails jamais touchés**.
- **Serveur** — `SyncPushController::insertChild()` : `if (find($row['id']) !== null) return;`
  → jamais de mise à jour, jamais de suppression d'une ligne retirée sur le poste.

Conséquence : une commande modifiée sur A arrive sur B avec le bon en-tête et les
**anciennes** lignes. Et comme les deux postes descendent d'une base commune, la plupart
des commandes existent déjà des deux côtés → le cas « détails jamais mis à jour » est le
cas **normal**, pas le cas rare.

⚠️ Le même `insertChild` sert aux **réceptions**, qui sont modifiables depuis la v1.3.0 et
qui **pilotent le stock** (le serveur rejoue les mouvements à partir de sa copie). Une
réception corrigée sur un poste laisse donc le serveur — et l'autre poste — sur les
quantités d'avant.

### Cause n°2 — un refus à l'application est invisible

`syncSimpleEntity()` attrape chaque erreur ligne par ligne et la range dans `errors[]`.
L'interface (`SyncStatus.tsx`) n'en affiche que le nombre : « N erreur(s) — voir logs ».
Un produit qui n'a pas pu être écrit disparaît donc **sans un mot**.

### Cause n°3 — collision de référence produit (piste n°1 pour le produit `lv`)

`applyRemoteToLocal` des produits fait `onConflictDoUpdate({ target: products.id })` :
seul un conflit d'**id** est prévu. Si le poste B possède déjà un produit portant la
référence `A237-17` sous un **autre id** (les références sont saisies à la main, les deux
postes numérotent pareil), l'index unique sur `reference` déclenche une erreur, avalée par
la cause n°2 → le produit n'arrive jamais, et n'arrivera jamais.

À confirmer sur la base réelle de B (voir « à faire »).

### Cause n°4 — l'unicité de `products.reference` est aveugle au soft delete côté API

Postgres : `products_reference_unique UNIQUE btree (reference)` — sans
`WHERE deleted_at IS NULL`. Côté poste l'index est **partiel** (corrigé le 22/07).
Une référence libérée sur un poste reste donc prise sur le serveur : l'envoi est refusé
définitivement. Même famille de bug que celui de FEUJIO du 11/08.

### À faire

1. Récupérer **les deux bases** (bouton « Envoyer plutôt le fichier de base » sur chaque
   poste) pour prouver les causes 1 et 3 sur les vraies données.
2. Corriger : réconciliation complète des lignes/pointures dans les deux sens, remontée
   visible des refus, règle de résolution des références en collision, index unique
   partiel côté API.
3. Rejouer le banc deux postes headless avec un scénario « commande modifiée » et
   « référence en collision » — les 27 assertions actuelles ne couvrent que la création.

### ✅ Corrigé ET DÉPLOYÉ le 19/08 (desktop `527a42b` + **v1.8.0** / API `dabdba4` + `50cfa91`)

| Défaut | Correction |
|---|---|
| Détails de commande figés au premier envoi | Réconciliation complète des lignes et pointures, dans les deux sens, dès que la version distante l'emporte |
| Arrivage corrigé → stock d'avant | Mouvements recalculés quand le détail bouge, des deux côtés |
| Arrivage appliqué avant sa commande → aucun mouvement, pour toujours | Rattrapage en fin de bundle, rejoué tant que la commande manque |
| Pointures qui s'empilent quand un poste en retard pousse | Un poste qui n'a pas gagné l'arbitrage n'ajoute des pointures qu'à une ligne qui n'en a aucune |
| Référence produit en collision → produit jamais reçu, en silence | Le produit distant garde sa référence, le local est renommé, et c'est **écrit à l'écran** |
| « N erreur(s) — voir logs » | La liste des lignes non appliquées, en clair, dans le panneau de synchro |
| `products.reference` unique aveugle au soft delete (API) | Migration `000016` : index partiel `WHERE deleted_at IS NULL` (essai à blanc concluant sur le schéma de prod) |

**Preuves** — API : 28 tests / 99 assertions (les 3 nouveaux tests de réconciliation
échouent sur le code d'avant). Poste : banc deux postes headless, deux vraies bases SQLite
contre une vraie API Laravel, rejouant le scénario exact de Franck — **22 assertions
vertes, 10 échecs sur le code d'avant**, dont `UNIQUE constraint failed: products.reference`
qui confirme la cause du produit « lv » invisible.

Banc conservé : `bench-detail.ts` (scratchpad de session) — à reprendre pour toute
modification de la synchro.

### Ce qui reste ouvert

1. ~~Déploiement~~ **FAIT** : API déployée (CI + deploy verts), migration `000016` `Ran` en
   prod, index partiel vérifié ; desktop **v1.8.0** publiée, `latest.yml` en anonyme →
   `version: 1.8.0`, installeur → 206. ⚠️ **Les deux postes ne reçoivent la correction
   qu'après avoir fermé et rouvert l'application.**
2. **Pourquoi 0 pointure sur le serveur de prod** reste non expliqué : le serveur les
   accepte (test vert sur l'ancien code aussi). Il faut voir la base d'un poste pour
   savoir s'il les envoie. → demander les 2 bases via « Envoyer plutôt le fichier de base ».
3. Après déploiement, contrôler en prod : `select count(*) from carton_size_compositions;`
   doit cesser d'être à 0.

---

## 19/08 (suite) — v1.9.0 : « Vérifier la synchronisation »

Franck : « je veux être sûr que tout fonctionne à cent pour cent ». Impossible à
affirmer sans instrument : `Envoyer` et `Synchroniser` racontent ce qu'ils viennent de
faire, aucun des deux ne dit **ce qui manque**. Comparer deux tableaux à l'œil, écran
contre écran, était le seul recours.

- **API `e77d1c4`** : `GET /api/v1/sync/inventory` (ability `sync:pull`, déjà existante) —
  identifiants, horodatages et **comptes d'enfants** par ligne, jamais le contenu.
  Quelques dizaines de Ko contre plusieurs Mo pour `/sync/pull` (photos produit).
- **Desktop `5adb2cd`, tag `v1.9.0`** : bouton dans le panneau de synchro. Par entité :
  combien de lignes de chaque côté, combien manquent **ici**, combien ne sont **pas encore
  parties**, et combien ont un **détail différent** — avec un exemple.

**Pourquoi les comptes d'enfants** : le défaut du 19/08 faisait arriver une commande avec
son en-tête et sans son détail. Un contrôle qui ne compare que les identifiants aurait
répondu « tout est là » alors que le tableau était incomplet.

**Vérifications** : API 31 tests / 107 assertions ; banc deux postes **25 assertions
vertes**, dont « le contrôle voit une commande amputée de ses pointures » et « le contrôle
voit la ligne pas encore envoyée ». Déployé : route vivante en prod (401 sans jeton),
`latest.yml` en anonyme → `version: 1.9.0`, installeur → 206.
