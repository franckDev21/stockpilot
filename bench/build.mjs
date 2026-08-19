import { build } from 'esbuild'
import path from 'node:path'

// Le banc utilise le VRAI code du dépôt ; seuls `electron` et `db/index` sont
// remplacés — le premier n'existe pas hors d'Electron, le second doit pouvoir
// basculer entre deux fichiers SQLite pour jouer deux postes.
const stubs = {
  name: 'stubs',
  setup(b) {
    b.onResolve({ filter: /^electron$/ }, () => ({ path: '/bench/stubs/electron.ts' }))
    b.onResolve({ filter: /(^|\/)db\/index$/ }, () => ({ path: '/bench/stubs/db-index.ts' }))
  },
}

await build({
  entryPoints: ['/bench/bench-detail.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  outfile: '/bench/bench-detail.cjs',
  external: ['better-sqlite3', 'drizzle-orm/better-sqlite3'],
  plugins: [stubs],
})
console.log('bundle ok')
