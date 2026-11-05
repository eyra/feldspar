// Tailwind rebases imported URLs to node_modules. Published Feldspar must be self-contained.
import { rebasePrismFonts } from './prism-assets.mjs'
import { createRequire } from 'node:module'
import { readFile, writeFile, cp, mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
const require = createRequire(import.meta.url)
const prism = dirname(require.resolve('@novasoftwarefoundation/prism'))
const cssPath = new URL('../dist/styles.css', import.meta.url)
const css = await readFile(cssPath, 'utf8')
const bundled = rebasePrismFonts(css)
await rm(new URL('../dist/fonts/', import.meta.url), { recursive: true, force: true })
await mkdir(new URL('../dist/fonts/', import.meta.url), { recursive: true })
await cp(join(prism, 'fonts'), new URL('../dist/fonts/', import.meta.url), { recursive: true })
await writeFile(cssPath, bundled)
