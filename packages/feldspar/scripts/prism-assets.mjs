export function rebasePrismFonts(css) {
  const bundled = css.replace(/url\((['"]?)[^()]*\/@novasoftwarefoundation\/prism\/fonts\/([^'"()]+)\1\)/g, 'url(./fonts/$2)')
  if (bundled.includes('node_modules')) throw new Error('CSS contains an unbundled dependency URL')
  return bundled
}
