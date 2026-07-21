# StockPilot — Publier des mises à jour automatiques (auto-update)

L'app est configurée pour se mettre à jour **toute seule** via **GitHub Releases** (`electron-updater`).
Une fois installée chez l'utilisateur, tu n'as **plus jamais** à lui renvoyer un installeur : il suffit de publier une nouvelle version.

---

## 🔧 Configuration initiale (une seule fois)

### 1. Créer le dépôt GitHub
- Crée un repo **public** nommé `stockpilot` sous ton compte.
- Le compte/repo sont déclarés dans `electron-builder.json5` :
  ```json5
  "publish": [{ "provider": "github", "owner": "franckDev21", "repo": "stockpilot" }]
  ```
  👉 **Remplace `owner` (et `repo` si besoin)** par les tiens.

### 2. Créer un token GitHub
- GitHub → Settings → Developer settings → **Personal access tokens (classic)**.
- Coche le scope **`repo`**. Copie le token.
- Avant chaque publication, expose-le :
  ```bash
  export GH_TOKEN="ghp_xxxxxxxxxxxxxxxxx"
  ```

### 3. (Recommandé) Signature de code
- **Windows** : sans certificat, l'app fonctionne et se met à jour, mais Windows SmartScreen affiche un avertissement à la 1ʳᵉ installation. Un certificat de signature (~200–400 €/an) le supprime.
- **macOS** : ⚠️ l'auto-update **ne s'applique pas** sur une app non signée. Pour que le mac auto-update fonctionne, il faut un compte **Apple Developer (99 $/an)** + signature + notarisation. Sans ça, l'utilisateur mac devra réinstaller le `.dmg` manuellement (le PC Windows, lui, se met à jour sans signature).

---

## 🚀 Publier une nouvelle version

1. **Incrémente la version** dans `package.json` (obligatoire, sinon pas de mise à jour) :
   ```json
   "version": "1.0.1"
   ```
2. Expose le token :
   ```bash
   export GH_TOKEN="ghp_xxxx"
   ```
3. Lance la publication :
   ```bash
   # Windows (depuis un PC Windows) :
   npm run release:win

   # macOS (depuis un Mac) :
   npm run release:mac
   ```
   electron-builder construit l'installeur **et** l'uploade automatiquement dans une **release GitHub** (en brouillon).
4. Va sur GitHub → **Releases** → ouvre le brouillon → clique **Publish release**.

C'est tout. Les apps déjà installées détecteront la nouvelle version au prochain lancement (ou dans les 4 h), la téléchargeront en arrière-plan, et proposeront à l'utilisateur **« Redémarrer et installer »**.

> 💡 Windows et macOS doivent être buildés **chacun sur sa plateforme** (ou via GitHub Actions). Un Mac ne peut pas produire l'installeur Windows signé, et inversement.

---

## 🤖 (Option) Publication automatique via GitHub Actions

Pour builder Windows **et** Mac automatiquement à chaque tag, crée `.github/workflows/release.yml` :

```yaml
name: Release
on:
  push:
    tags: ['v*']
jobs:
  release:
    strategy:
      matrix:
        os: [macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build -- --publish always
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Ensuite, pour publier : `git tag v1.0.1 && git push --tags`.

---

## 🧪 Comment ça marche côté app (déjà en place)

- `electron/updater.ts` : interroge GitHub, télécharge, notifie le renderer. Désactivé en dev et tolérant si le module est absent.
- `src/components/UpdateToast.tsx` : affiche la progression puis le bouton **« Redémarrer et installer »**.
- Rien à faire côté code pour une nouvelle release : seulement bump de version + `npm run release:*`.

---

## ❓ Rappel des limites

| Plateforme | Auto-update sans signature | Avec signature |
|---|---|---|
| **Windows** | ✅ fonctionne (avertissement SmartScreen à la 1ʳᵉ install) | ✅ propre |
| **macOS**   | ❌ nécessite signature+notarisation | ✅ fonctionne |

Pour un déploiement 100 % fluide, **Windows est le plus simple** (aucune signature obligatoire pour que l'auto-update marche).
