import { register } from 'node:module'
import { JSDOM } from 'jsdom'
register('./svg-loader.mjs', import.meta.url)
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'MouseEvent', 'Event']) {
  globalThis[name] = dom.window[name]
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true
