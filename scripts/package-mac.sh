#!/bin/bash
set -e

APP_NAME="StockPilot"
VERSION="1.0.0"
BUNDLE_ID="com.feujio.stockpilot"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ELECTRON_DIST="$ROOT/node_modules/electron/dist"
OUT="$ROOT/release/$APP_NAME-darwin-arm64"
APP="$OUT/$APP_NAME.app"

echo "📦 Packaging $APP_NAME v$VERSION pour macOS..."

# ── Nettoyage ─────────────────────────────────────────────────────────
rm -rf "$OUT"
mkdir -p "$OUT"

# ── Copie du binaire Electron ─────────────────────────────────────────
echo "  → Copie du binaire Electron..."
cp -R "$ELECTRON_DIST/Electron.app" "$APP"

# ── Renommage des binaires internes ──────────────────────────────────
MACOS="$APP/Contents/MacOS"
mv "$MACOS/Electron" "$MACOS/$APP_NAME"

# Renommer les Helpers
for helper in "Electron Helper" "Electron Helper (GPU)" "Electron Helper (Plugin)" "Electron Helper (Renderer)"; do
  NEW="${helper/Electron/$APP_NAME}"
  if [ -d "$APP/Contents/Frameworks/$helper.app" ]; then
    mv "$APP/Contents/Frameworks/$helper.app" "$APP/Contents/Frameworks/$NEW.app" 2>/dev/null || true
    BIN="$APP/Contents/Frameworks/$NEW.app/Contents/MacOS"
    if [ -f "$BIN/$helper" ]; then
      mv "$BIN/$helper" "$BIN/$NEW"
    fi
  fi
done

# ── Info.plist ────────────────────────────────────────────────────────
echo "  → Mise à jour Info.plist..."
PLIST="$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleName $APP_NAME"              "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName $APP_NAME"       "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier $BUNDLE_ID"       "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $VERSION"            "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $VERSION"  "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleExecutable $APP_NAME"        "$PLIST"

# ── Icône ─────────────────────────────────────────────────────────────
echo "  → Copie de l'icône..."
cp "$ROOT/build/icon.icns" "$APP/Contents/Resources/electron.icns"
/usr/libexec/PlistBuddy -c "Set :CFBundleIconFile electron" "$PLIST"

# ── Ressources de l'app ───────────────────────────────────────────────
echo "  → Copie des fichiers de l'app..."
RESOURCES="$APP/Contents/Resources/app"
mkdir -p "$RESOURCES"

cp -R "$ROOT/dist"          "$RESOURCES/dist"
cp -R "$ROOT/dist-electron" "$RESOURCES/dist-electron"
cp    "$ROOT/package.json"  "$RESOURCES/package.json"

# ── node_modules nécessaires (better-sqlite3, drizzle-orm, etc.) ──────
echo "  → Copie des dépendances natives..."
NM_SRC="$ROOT/node_modules"
NM_DST="$RESOURCES/node_modules"
mkdir -p "$NM_DST"

DEPS=(
  "better-sqlite3" "bindings" "file-uri-to-path"
  "drizzle-orm" "zustand" "react" "react-dom"
)

for dep in "${DEPS[@]}"; do
  if [ -d "$NM_SRC/$dep" ]; then
    cp -R "$NM_SRC/$dep" "$NM_DST/$dep"
  fi
done

# ── Suppression de la quarantaine macOS ──────────────────────────────
echo "  → Suppression de la quarantaine..."
xattr -cr "$APP" 2>/dev/null || true

echo ""
echo "✅ Build terminé !"
echo "   → $APP"
echo ""
echo "💡 Pour lancer l'app : open \"$APP\""
echo "💡 Pour l'installer  : cp -R \"$APP\" /Applications/"
