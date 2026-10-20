import type { HostWindow } from './connect.js'

// Tells the host the height of the app: Next sizes the iframe from { action: 'resize', height }.
// Once at the start and whenever the body changes size. Returns a function that stops
// reporting. Does nothing outside an iframe.
export function reportSize (win: HostWindow): () => void {
  const { document: doc, ResizeObserver: Observer } = win
  if ((win.parent as unknown) === win || doc === undefined) return () => {}
  const post = (): void => {
    win.parent.postMessage({ action: 'resize', height: doc.documentElement.getBoundingClientRect().height }, '*')
  }
  post()
  if (Observer === undefined) return () => {}
  const observer = new Observer(post)
  observer.observe(doc.body)
  return () => observer.disconnect()
}
