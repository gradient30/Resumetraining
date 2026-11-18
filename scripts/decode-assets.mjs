// Decode the base64 image sources in src/assets into real image files
// before Vite bundles them. The photos are stored as .b64 text files
// because the GitHub push path only accepts UTF-8 content, so binary
// images cannot be pushed directly. Run automatically as the first step
// of `npm run build` (see package.json). Idempotent: only rewrites a
// file when its decoded bytes differ from what is already on disk.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, basename, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets')
let decoded = 0
for (const name of readdirSync(dir)) {
  if (!name.endsWith('.b64')) continue
  const outName = name.slice(0, -4) // strip .b64
  const outPath = join(dir, outName)
  const buf = Buffer.from(readFileSync(join(dir, name), 'utf8').trim(), 'base64')
  if (existsSync(outPath) && readFileSync(outPath).equals(buf)) continue
  writeFileSync(outPath, buf)
  decoded++
}
console.log(`decode-assets: ${decoded} image(s) written to src/assets`)
