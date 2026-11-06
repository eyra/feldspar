export async function load(url, context, nextLoad) {
  if (url.endsWith('.svg')) return { format: 'module', source: `export default ${JSON.stringify(url)}`, shortCircuit: true }
  return nextLoad(url, context)
}
