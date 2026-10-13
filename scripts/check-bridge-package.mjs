// Verifies the bridge package: consistent name, and a tarball that contains only what it should.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf-8'))
const bridge = read('../packages/feldspar-bridge/package.json')
const consumer = read('../packages/feldspar/package.json')
const failures = []

for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies', 'bundleDependencies', 'bundledDependencies']) {
  if (Object.keys(bridge[field] ?? {}).length > 0) failures.push(`bridge must have no ${field}`)
}

if (!consumer.dependencies?.[bridge.name]) {
  failures.push(`packages/feldspar does not depend on ${bridge.name}`)
}
let reexport = ''
try {
  reexport = readFileSync(new URL('../packages/feldspar/src/framework/bridge.ts', import.meta.url), 'utf-8')
} catch {
  // a missing file is reported below as a failure
}
if (!reexport.includes(`'${bridge.name}'`)) {
  failures.push(`packages/feldspar/src/framework/bridge.ts does not re-export ${bridge.name}`)
}

const out = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  cwd: new URL('../packages/feldspar-bridge/', import.meta.url),
  encoding: 'utf-8',
})
const files = JSON.parse(out)[0].files.map((f) => f.path)
const allowed = [/^package\.json$/, /^LICENSE$/, /^README\.md$/, /^dist\/[a-z_]+\.js$/, /^dist\/[a-z_]+\.d\.ts$/]
for (const file of files) {
  if (!allowed.some((re) => re.test(file))) failures.push(`unexpected file in tarball: ${file}`)
}
for (const required of ['package.json', 'LICENSE', 'README.md', 'dist/index.js', 'dist/index.d.ts']) {
  if (!files.includes(required)) failures.push(`missing file in tarball: ${required}`)
}
if (files.some((f) => f.includes('.test.'))) failures.push('test files in tarball')

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`${bridge.name}@${bridge.version}: ${files.length} files, name consistent`)
