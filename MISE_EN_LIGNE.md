# Mise en ligne — procédure, pannes possibles et remise en service

Compagnon de [`SYNC_PROGRESS.md`](./SYNC_PROGRESS.md). À ouvrir **pendant** la mise en
ligne, pas après.

---

## 0. Ce qui est prouvé, et ce qui ne l'est pas

Il n'y a pas de « 100 % » ici, et le prétendre ferait perdre du temps le jour où ça casse.
Voici le niveau de confiance réel, morceau par morceau.

| Élément | Niveau de vérification |
|---|---|
| Synchro ventes / suppressions / rejeu du stock | **Prouvé** — 21 assertions, 2 vraies bases SQLite ↔ API réelle ; le même banc échoue 11× sur le code d'avant |
| Endpoint `POST /api/v1/backups` | **Prouvé** — envoi, refus d'un non-SQLite, sha256 identique, téléchargement, suppression, sur le domaine public |
| Correctif WAL des sauvegardes | **Prouvé** — cas réel 4 Ko + WAL 873 Ko : 0 table → 17 tables, `integrity_check` ok |
| Outil de fusion | **Prouvé** — sur deux bases réellement divergentes, 0 violation de clé étrangère, stock non doublé |
| **Bouton « Envoyer au serveur » (desktop)** | ⚠️ **Compilé seulement.** Jamais exécuté. Le banc n'a pas pu tourner. |
| **Toute l'interface** | ⚠️ **Jamais exercée** — pas d'Electron sur le serveur de dev. Limitation permanente du projet. |

Conséquence pratique : les deux dernières lignes sont les endroits où regarder en premier
si quelque chose cloche.

---

## 1. Procédure de mise en ligne

Trois étapes, **dans cet ordre**. Ne pas enchaîner sans la vérification de chacune.

### Étape 1 — API

⚠️ **Le plus urgent.** Le conteneur monte le code en bind (`.:/var/www/html`) : les
fichiers actuels **servent déjà la production sans être commités**. Or le déploiement
fait un `git pull`. C'est exactement le scénario qui a bloqué toutes les migrations
FEUJIO le 31 juillet.

```bash
cd /home/admin/stockpilot-api
git status --short          # doit lister les 7 fichiers attendus
git add -A
git commit -m "feat(sauvegardes): recevoir la base d'un poste par l'API"
git push origin main        # déclenche CI + Deploy
```

**Vérifier avant de continuer :**

```bash
gh run list --limit 2                                    # les deux runs doivent finir "success"
curl -s https://stockpilot.feujio.com/api/v1/health      # {"status":"ok",...}
curl -s -o /dev/null -w '%{http_code}\n' \
     https://stockpilot.feujio.com/api/v1/backups        # 401 = route vivante (pas 404)
docker compose exec -T php php -i | grep upload_max_filesize   # doit dire 128M
```

Si `/backups` renvoie **404** : les routes sont en cache.
→ `docker compose exec -T php php artisan route:clear && docker compose exec -T php php artisan route:cache`

### Étape 2 — Desktop, le code

```bash
cd /home/admin/stockpilot
git add -A
git commit -m "feat(sauvegardes): envoyer la base du poste au serveur"
git push origin main
```

Rien n'est encore livré au client à ce stade : `release.yml` ne se déclenche **que sur un
tag `v*`**, jamais sur un push `main`.

### Étape 3 — Desktop, la version

```bash
cd /home/admin/stockpilot
# passer "version" à 1.5.0 dans package.json
git add package.json && git commit -m "chore: version 1.5.0"
git push origin main
git tag v1.5.0 && git push origin v1.5.0
```

**Vérifier — c'est la seule vérification qui compte vraiment**, en anonyme, comme le fait
`electron-updater` :

```bash
gh run watch $(gh run list --workflow=release.yml --limit 1 --json databaseId --jq '.[0].databaseId') --exit-status

curl -sL https://github.com/franckDev21/stockpilot/releases/latest/download/latest.yml
# doit afficher : version: 1.5.0

curl -sL -o /dev/null -r 0-1023 -w '%{http_code}\n' \
  https://github.com/franckDev21/stockpilot/releases/download/v1.5.0/StockPilot-Windows-1.5.0-Setup.exe
# doit afficher : 206
```

Tant que ces deux dernières commandes ne répondent pas 200 puis 206 **sans jeton**, aucun
poste client ne recevra rien.

---

## 2. Scénarios d'échec

### S1 — Le déploiement CI de l'API échoue sur `git pull`

**Symptôme** : le run « Deploy — Production » sort en erreur sur `git pull`, message de
type *local changes would be overwritten*.

**Cause** : des fichiers modifiés non commités sur le serveur. Précédent vécu : une
migration WIP non commitée avait survécu au deploy et bloqué toutes les migrations
suivantes.

**Résolution**

```bash
cd /home/admin/stockpilot-api
git status --short                      # identifier ce qui traîne
git stash                               # ou committer si c'est du vrai travail
git pull origin main
git stash pop                           # puis arbitrer proprement
```
Puis relancer : `gh run rerun <id> --failed`

---

### S2 — Le déploiement échoue sur « insufficient permission for adding an object »

**Symptôme** : `git fetch` refusé pendant le deploy.

**Cause** : un `umask` restrictif posé par un script précédent a fuité et cassé les droits
de `.git/objects`. Déjà vu sur ai-feujio : le run qui posait l'umask passait, c'est le
**suivant** qui mourait.

**Résolution**

```bash
cd /home/admin/stockpilot-api
find .git/objects -type d ! -perm -u+rwx -exec chmod u+rwx {} \;
find .git/objects -type f ! -perm -u+rw  -exec chmod u+rw  {} \;
git fsck --connectivity-only            # doit être propre
```

---

### S3 — Le déploiement expire sur `dial tcp ***:22: i/o timeout`

**Symptôme** : le run reste bloqué puis échoue à la connexion SSH.

**Cause** : l'IP publique du serveur a changé, le secret `DEPLOY_HOST` pointe sur
l'ancienne. Déjà arrivé le 31 juillet.

**Résolution**

```bash
curl -s -4 https://ifconfig.me                                     # IP réelle
gh secret list --env production -R franckDev21/stockpilot-api      # ⚠️ --env, sinon vide
gh secret set DEPLOY_HOST --env production -R franckDev21/stockpilot-api
```
**Fond du problème** : tant que l'IP est dynamique, ça se reproduira. Mettre un nom DNS
(`stockpilot.feujio.com` résout déjà vers le serveur).

---

### S4 — L'envoi échoue avec « 413 Request Entity Too Large »

**Symptôme** : page d'erreur **HTML** de nginx, pas du JSON. C'est le signe distinctif :
la requête n'a jamais atteint PHP.

**Cause** : la base dépasse la limite du vhost public, restée à **50 Mo** (je n'ai pas pu
la modifier, c'est un fichier système hors dépôt).

**Résolution**

```bash
sudo cp /etc/nginx/sites-enabled/feujio.com /etc/nginx/sites-enabled/feujio.com.bak
sudo nano /etc/nginx/sites-enabled/feujio.com
#   dans le bloc « server_name stockpilot.feujio.com; » UNIQUEMENT :
#   client_max_body_size 50M;   →   client_max_body_size 256M;
sudo nginx -t && sudo systemctl reload nginx
```
⚠️ Ne pas toucher aux autres blocs du fichier : il sert **tous** les sous-domaines
feujio. Et `sites-available` est **périmé** — c'est bien `sites-enabled` qu'on édite.

Relever aussi la limite du conteneur si besoin : `docker/nginx/default.conf` (à 128 Mo).

**Contournement immédiat**, sans toucher à nginx : sauvegarder la base depuis l'app et me
l'envoyer par `scp`.

---

### S5 — L'envoi échoue avec « Ce fichier n'est pas une base SQLite » (422)

**Symptôme** : message JSON explicite, l'envoi est refusé.

**Cause** : le fichier ne commence pas par les 16 octets `SQLite format 3`. Soit il est
tronqué, soit il vient d'une version antérieure à 1.4.0 dont la sauvegarde perdait le WAL.

**Diagnostic**

```bash
head -c 16 fichier.db | xxd | head -1     # doit montrer "SQLite format 3"
```

**Résolution** : mettre le poste à jour (≥ 1.4.0) et refaire l'envoi. Si le poste ne peut
pas être mis à jour, copier **les trois** fichiers `stockpilot.db`, `-wal` et `-shm`
depuis `userData` — l'outil de fusion sait les recoller.

---

### S6 — L'envoi échoue avec 401

**Cause** : identifiants faux, ou jeton Sanctum expiré (durée de vie 30 jours) dans
`sync-config.json`.

**Résolution** : dans la modale d'envoi, ressaisir email et mot de passe — le jeton est
alors obtenu pour cet envoi seulement. Si le poste utilisait la synchro, se reconnecter
via le panneau de synchronisation.

---

### S7 — L'envoi échoue avec 403

**Cause** : le jeton n'a pas l'habilitation `write`. `EnforceTokenAbilities` exige `read`
en GET et `write` en écriture. Un jeton en lecture seule (celui de l'assistant IA, par
exemple) sera refusé.

**Résolution** : utiliser un jeton issu d'une connexion normale — ils portent `['*']`.

---

### S8 — L'envoi « réussit » mais je ne vois pas le fichier sur le serveur

**Symptôme** : `201` côté app, mais `ls` ne montre rien.

**Cause** : Laravel crée `storage/app/private/backups` en **0700** pour `www-data`, et
`storage/` est monté en bind → invisible depuis l'hôte. Le contrôleur fait un `chmod`
après écriture, mais il est en `@` (silencieux) et peut échouer.

**Diagnostic**

```bash
docker compose exec -T php ls -l /var/www/html/storage/app/private/backups/   # la vérité
ls -l /home/admin/stockpilot-api/storage/app/private/backups/                 # ce que voit l'hôte
```

**Résolution**

```bash
docker compose exec -T php chmod 755 /var/www/html/storage/app/private/backups
docker compose exec -T php sh -c 'chmod 644 /var/www/html/storage/app/private/backups/*.db'
```

**Ou, sans permissions du tout** — récupérer par l'API, qui marche quoi qu'il arrive :

```bash
curl -s -H "Authorization: Bearer $TOKEN" https://stockpilot.feujio.com/api/v1/backups
curl -s -H "Authorization: Bearer $TOKEN" -o posteA.db \
     https://stockpilot.feujio.com/api/v1/backups/<id>/download
```

---

### S9 — Le bouton « Envoyer au serveur » ne fait rien, ou plante

⚠️ **Le scénario le plus probable de tous** : c'est le seul chemin non exercé au runtime.

**Diagnostic** : ouvrir la console de l'app (`Ctrl+Shift+I`), onglet Console, et refaire
l'action. L'erreur remonte du processus principal via l'IPC.

**Causes plausibles, par ordre de vraisemblance**

1. `getSqlite()` lève « Database not initialized » → la base n'était pas ouverte au moment
   du clic. Redémarrer l'app.
2. `FormData` / `Blob` indisponibles — improbable (Electron 32 = Node 20, ils sont
   globaux), mais ce serait une erreur `ReferenceError` nette.
3. Écriture impossible dans le dossier temporaire → erreur `EACCES`/`ENOSPC`.

**Contournement immédiat, qui marche toujours** : bouton **Sauvegarder** (lui, il est
prouvé), puis `scp` du fichier vers
`/home/admin/stockpilot-fusion/bases/`. La fonctionnalité d'envoi est un confort, pas un
passage obligé — elle ne bloque jamais la fusion.

**Résolution de fond** : corriger, rebumper, retagger. Aucune donnée n'est en jeu, l'envoi
ne modifie rien sur le poste.

---

### S10 — Le build Windows échoue

**Symptôme** : run « Build & Release Windows » rouge.

**Diagnostic** : `gh run view <id> --log-failed`

**Causes fréquentes** : `npm ci` qui casse sur `package-lock.json` désynchronisé, ou la
recompilation native de `better-sqlite3`.

**Important** : un build raté ne livre rien — les postes restent sur la version
précédente, ils ne se retrouvent jamais dans un état bâtard. On peut corriger et
retagger tranquillement.

```bash
git tag -d v1.5.0 && git push origin :refs/tags/v1.5.0   # retirer le tag raté
# corriger, recommiter, puis re-tagger
```

---

### S11 — La release est verte mais aucun poste ne reçoit rien

**Symptôme** : workflow vert, release visible sur GitHub, mais aucun toast chez le client.

**Cause historique du projet** : `electron-updater` interroge GitHub **anonymement**. Quand
le dépôt était privé, il recevait un 404 sur `latest.yml` — tout semblait vert côté
GitHub, et pourtant aucun client n'a jamais été mis à jour.

**Diagnostic — sans jeton, impérativement**

```bash
curl -sL https://github.com/franckDev21/stockpilot/releases/latest/download/latest.yml
```

**Résolutions selon le cas**
- 404 → le dépôt est repassé privé : le remettre **public**.
- La release est en **draft** → la publier.
- `version:` affiche l'ancienne → le tag n'a pas été poussé, ou le workflow n'a pas tourné.

⚠️ **Ne jamais changer le canal de mise à jour** (provider, dépôt de releases, renommage) :
l'URL du feed est **gravée dans le `.exe`** au build. En changer invaliderait toutes les
installations existantes et imposerait une réinstallation manuelle chez le client.

---

### S12 — Le poste affiche encore l'ancienne version après mise à jour

**Cause** : `electron-updater` télécharge en tâche de fond et n'installe qu'au
redémarrage.

**Résolution** : fermer complètement l'app (pas seulement la fenêtre) et la rouvrir. Si
après deux redémarrages rien ne change, passer à **S11**.

---

### S13 — La fusion signale des collisions de référence

**Symptôme** : `fusion.mjs inspect` liste des `⚠️ COLLISION(S) DE RÉFÉRENCE`.

**Ce que ça veut dire** : les deux postes ont un enregistrement portant la **même
référence** mais un **identifiant différent**. La machine ne peut pas deviner s'il s'agit
du même objet saisi deux fois ou de deux objets distincts.

**Résolution** : trancher au cas par cas. Pour chaque collision, décider lequel des deux
garder, puis renommer la référence du perdant **avant** de fusionner.

**Ce qui arrive si on l'ignore** : le second poste qui synchronise reçoit une **500** sur
l'index unique. Sans perte de données — les lignes fautives ne partent simplement pas —
mais avec une synchro incomplète et des erreurs incompréhensibles.

---

### S14 — Après fusion, le stock a doublé

**Cause** : `stock_movements` fusionné par UUID. Chaque poste génère **ses propres**
lignes de mouvement pour un même événement réel — une union naïve double tout.

L'outil applique déjà la bonne règle (raisonnement par `reference_id`), mais **vérifier
systématiquement** :

```bash
docker run --rm -v "$PWD":/f -w /f node:20 node --input-type=module -e "
import Database from 'better-sqlite3';
const d = new Database('/f/fusionnee.db', { readonly: true });
console.log(d.prepare('SELECT product_id, size, SUM(quantity) q FROM stock_movements GROUP BY 1,2').all());
"
```
Comparer avec le même calcul sur `posteA.db` et `posteB.db`. Les totaux doivent être
cohérents, jamais la somme des deux.

---

### S15 — La restauration a cassé le poste

**Symptôme** : après « Restaurer », l'app ne redémarre pas ou affiche une base vide.

**Filet déjà en place** : la base d'avant est conservée en
`stockpilot.db.avant-restauration` dans le dossier `userData`.

**Résolution manuelle**

```
1. Fermer complètement l'application.
2. Dans userData : supprimer stockpilot.db, stockpilot.db-wal, stockpilot.db-shm
3. Renommer stockpilot.db.avant-restauration en stockpilot.db
4. Rouvrir l'application.
```
⚠️ Bien supprimer les `-wal`/`-shm` : laissés en place, SQLite les réapplique par-dessus
la base restaurée.

Chemin `userData` sous Windows : `%APPDATA%\StockPilot`

---

### S16 — Les sauvegardes s'accumulent sur le serveur

**Diagnostic**

```bash
du -sh /home/admin/stockpilot-api/storage/app/private/backups/
curl -s -H "Authorization: Bearer $TOKEN" https://stockpilot.feujio.com/api/v1/backups
```

**Résolution** : supprimer par l'API, qui nettoie fichier **et** enregistrement d'un coup :

```bash
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" \
     https://stockpilot.feujio.com/api/v1/backups/<id>
```
Ne pas supprimer les fichiers à la main : la table garderait des lignes orphelines.

---

## 3. Retour en arrière

| Ce qu'on veut annuler | Comment |
|---|---|
| Une version desktop publiée | Retagger la **précédente** ne suffit pas — `electron-updater` compare les numéros. Il faut publier une **1.5.1** corrective. |
| Le code de l'API | `git revert <commit> && git push` → le déploiement repart tout seul |
| La migration `database_backups` | `docker compose run --rm php php artisan migrate:rollback --step=1` ⚠️ **jamais `migrate:fresh`** : ça viderait toute la base de production |
| Une restauration ratée sur un poste | Voir **S15** |

---

## 4. Le principe à garder en tête

Aucune de ces étapes ne touche aux données des postes. L'envoi **copie**, la fusion
**écrit un nouveau fichier** sans modifier les sources, et la restauration **met de côté**
la base précédente. Le pire scénario réaliste, c'est de perdre du temps — pas des données.

La seule opération réellement destructive du lot serait `migrate:fresh` sur la base de
production. Elle n'apparaît nulle part dans cette procédure, et ne doit jamais y entrer.
