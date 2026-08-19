# Banc deux postes

Rejoue, **sans Electron**, ce que font deux postes qui se synchronisent : deux vraies
bases SQLite qui parlent à une vraie API Laravel. C'est le seul moyen de prouver le code
de synchronisation sur ce serveur — il n'y a pas d'Electron ici, et l'interface ne peut
donc jamais être cliquée.

Le banc utilise le **vrai code du dépôt** ; seuls `electron` et `electron/db/index` sont
remplacés (`stubs/`) — le premier n'existe pas hors d'Electron, le second doit pouvoir
basculer entre deux fichiers SQLite pour jouer deux postes.

Deux scénarios, deux fichiers : `bench-detail.ts` (le détail des commandes qui ne
circulait pas) et `bench-suppression.ts` (la suppression qui détruisait au lieu de
recharger).

## `bench-suppression.ts` — « j'ai supprimé pour recharger » (17 assertions)

Le geste du 19/08 après-midi, celui qui a coûté 24 commandes :

1. A saisit trois commandes et les envoie ;
2. B se synchronise → il les a, avec leur détail ;
3. **B les supprime** en pensant les retélécharger ;
4. B clique « Synchroniser » → il doit **les retrouver**, le compteur doit le dire, et
   A ne doit **rien** avoir perdu ;
5. « Supprimer partout » sur B → cette fois elles disparaissent vraiment, des deux côtés,
   et ne reviennent plus.

Sur le code d'avant, les points 4 et 5 échouent : B reste à zéro **et A perd ses trois
commandes**. C'est la preuve que la règle « une suppression ne part que sur ordre
explicite » n'est pas décorative.

## `bench-refus.ts` — quand le serveur refuse l'envoi (19 assertions)

Le 19/08 à 16 h 15, « Supprimer partout » a répondu « Invalid ability provided. » : le
droit d'écriture du jeton avait été retiré. Ce banc tient les deux défauts que ça a
révélés — un message de serveur servi tel quel au client, et des lignes marquées
supprimées sur le poste avant un envoi qui échoue. Il couvre aussi le bandeau des lignes
rétablies, qui ne se vidait jamais tout seul (v1.10.3).

Seul banc à **ne pas** demander l'API Laravel : c'est la réaction du poste à un refus
qu'on éprouve, un serveur bouchon suffit et permet de rejouer le 403 à volonté.
**4 assertions échouent sur le code d'avant.**

## `bench-detail.ts` — les détails qui ne circulaient pas (25 assertions)

Le scénario exact rapporté le 19/08 :

1. le poste A saisit une commande à deux lignes avec pointures, puis un arrivage ;
2. le poste B, vide, se synchronise → il doit avoir **le détail complet** et le même stock ;
3. A **modifie** la commande (quantité changée, ligne retirée, pointures recréées) → B doit
   suivre, sans que les pointures s'empilent ;
4. A **corrige** l'arrivage (5 cartons → 3) → le stock de B doit suivre ;
5. A crée un produit dont la **référence est déjà prise** sur B → B doit quand même le
   recevoir, renommer le sien, et **le dire** ;
6. « Vérifier la synchronisation » doit voir une ligne pas encore envoyée et une commande
   amputée de ses pointures.

## Le lancer

Il faut une API locale. Depuis une copie du dépôt `stockpilot-api` :

```bash
composer install                                   # via l'image composer:2
php artisan migrate:fresh --force                  # DB_CONNECTION=sqlite
php artisan tinker --execute '...createToken("banc",["sync:push","sync:pull"])...'
php artisan serve --host 127.0.0.1 --port 8099
```

⚠️ **Vider `bootstrap/cache/routes-*.php`** après avoir ajouté une route, sinon elle
répond 404 sans raison apparente.

Puis, dans ce dossier, un `.env` (jamais commité) :

```
VITE_API_URL=http://127.0.0.1:8099
UPLOAD_TOKEN=<le jeton imprimé ci-dessus>
```

```bash
npm install
docker run --rm -v "$PWD":/bench -v /chemin/vers/stockpilot:/repo:ro -w /bench node:20 node build.mjs
docker run --rm --network host -v "$PWD":/bench -v /chemin/vers/stockpilot:/repo:ro -w /bench \
  -e BENCH_USERDATA=/bench/userdata -e APP_ROOT=/bench node:20 node bench-detail.cjs
docker run --rm --network host -v "$PWD":/bench -v /chemin/vers/stockpilot:/repo:ro -w /bench \
  -e BENCH_USERDATA=/bench/userdataA -e APP_ROOT=/bench node:20 node bench-suppression.cjs
docker run --rm --network host -v "$PWD":/bench -v /chemin/vers/stockpilot:/repo:ro -w /bench \
  -e BENCH_USERDATA=/bench/userdataRefus -e APP_ROOT=/bench node:20 node bench-refus.cjs
```

`bench-refus.cjs` se lance seul : ni API, ni jeton, ni `.env`.

## Pièges

- **SQLite horodate à la seconde.** Une modification faite dans la même seconde que la
  création n'est pas « plus récente » : le serveur la refuse et le banc échoue à tort.
  D'où les `pause(1100)` avant chaque modification.
- `better-sqlite3` du dépôt est recompilé pour l'ABI d'Electron : le banc utilise le sien
  (`package.json` d'ici).
- Pour comparer avec une version antérieure du code, extraire l'ancien dépôt
  (`git archive HEAD | tar -x -C ...`), y poser un lien `node_modules`, et dupliquer les
  stubs en changeant `/repo` pour le nouveau chemin.
