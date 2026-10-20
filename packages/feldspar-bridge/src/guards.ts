// Internal helper, not part of the public API.
export function isInstanceOf<T>(arg: any, type: string, properties: Array<keyof T>): arg is T {
  if (arg?.__type__ !== type) return false
  properties.forEach((property) => {
    if (arg[property] === undefined) throw new Error(`Property ${String(property)} is required`)
  })
  return true
}
