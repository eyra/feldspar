import { test } from 'node:test'
import assert from 'node:assert/strict'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { TableCellText } from '../src/framework/visualization/react/ui/elements/table_cell_text'

test('a cell decides on "Read full text" from its ResizeObserver without changing layout', async () => {
  const callbacks: ResizeObserverCallback[] = []
  Object.assign(globalThis, {
    ResizeObserver: class { constructor (callback: ResizeObserverCallback) { callbacks.push(callback) } observe () {} disconnect () {} },
    getComputedStyle: window.getComputedStyle.bind(window),
  })
  Object.defineProperty(document, 'fonts', { value: { status: 'loaded' }, configurable: true })

  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  await act(async () => root.render(<TableCellText text='A long message' field='Message' locale='en' />))
  const preview = host.querySelector('.table-text-preview') as HTMLElement
  preview.style.lineHeight = '16px'
  // Changing the clamp inside a ResizeObserver callback is what makes browsers report the loop.
  const clampWrites: string[] = []
  Object.defineProperty(preview.style, 'webkitLineClamp', { get: () => '3', set: (value: string) => { clampWrites.push(value) }, configurable: true })
  const observe = async (layout: { clientWidth: number, scrollHeight: number }): Promise<boolean> => {
    for (const [name, value] of Object.entries({ clientHeight: 48, ...layout })) {
      Object.defineProperty(preview, name, { value, configurable: true })
    }
    await act(async () => callbacks.at(-1)!([], {} as ResizeObserver))
    assert.deepEqual(clampWrites, [], 'the callback changed the clamp')
    return host.textContent!.includes('Read full text')
  }

  assert.equal(await observe({ clientWidth: 300, scrollHeight: 50 }), false, 'glyph overflow hides no line')
  assert.equal(await observe({ clientWidth: 300, scrollHeight: 64 }), true, 'one hidden line')
  assert.equal(await observe({ clientWidth: 0, scrollHeight: 64 }), false, 'hidden responsive table')

  await act(async () => root.unmount())
  host.remove()
})
