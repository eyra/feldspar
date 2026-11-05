import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { PrimaryButton } from '../src/framework/visualization/react/ui/elements/button'
import { CheckBox } from '../src/framework/visualization/react/ui/elements/check_box'
import { RadioItem } from '../src/framework/visualization/react/ui/elements/radio_item'
import { SearchBar } from '../src/framework/visualization/react/ui/elements/search_bar'
let root: Root
let host: HTMLDivElement
async function render(node: React.ReactNode) {
  if (!host) { host = document.createElement('div'); document.body.append(host); root = createRoot(host) }
  await act(async () => root.render(node))
  return host
}
afterEach(async () => { if (root) await act(async () => root.unmount()); host?.remove(); host = undefined!; root = undefined! })

test('disabled and loading primary actions cannot fire; enabled actions fire once', async () => {
  let calls = 0
  const props = { label: 'Continue', onClick: () => calls++ }
  for (const state of [{ enabled: false }, { spinning: true }]) {
    const el = await render(<PrimaryButton {...props} {...state} />)
    const action = el.querySelector('[role="button"],button') as HTMLElement
    await act(async () => action.click())
    assert.equal(calls, 0)
    assert.equal(action.tagName, 'BUTTON')
    assert.equal((action as HTMLButtonElement).disabled, true)
  }
  await render(<PrimaryButton {...props} />)
  await act(async () => host.querySelector('button')!.click())
  assert.equal(calls, 1)
})

test('selection adapters expose native controls and deliver one selection callback', async () => {
  let calls = 0
  await render(<CheckBox id="row-1" selected={false} onSelect={() => calls++} />)
  const checkbox = host.querySelector('input[type="checkbox"]') as HTMLInputElement
  assert.ok(checkbox)
  await act(async () => checkbox.click())
  assert.equal(calls, 1)
  await render(<CheckBox id="row-1" selected onSelect={() => calls++} />)
  assert.equal((host.querySelector('input') as HTMLInputElement).checked, true)
  await render(<RadioItem id={1} value="Donate" selected={false} onSelect={() => calls++} />)
  assert.ok(host.querySelector('input[type="radio"]'))
  await act(async () => host.querySelector('input')!.click())
  assert.equal(calls, 2)
})

test('search uses the requested debounce and latest callback, cancelling work on unmount', async ({ mock }) => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'] })
  const first: string[][] = [], latest: string[][] = []
  await render(<SearchBar placeholder="Search" debounce={10} onSearch={v => first.push(v)} />)
  const input = host.querySelector('input')!
  const change = async (value: string) => act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await change('two words')
  await act(async () => mock.timers.tick(5))
  await render(<SearchBar placeholder="Search" debounce={10} onSearch={v => latest.push(v)} />)
  await act(async () => mock.timers.tick(5))
  assert.deepEqual(first, [])
  assert.deepEqual(latest, [['two', 'words']])
  await act(async () => mock.timers.tick(40))
  assert.equal(latest.length, 1)
  await change('cancelled')
  await act(async () => root.unmount()); root = undefined!
  await act(async () => mock.timers.tick(40))
  assert.equal(latest.length, 1)
})

test('search cancels pending work when delay changes and uses the new delay', async ({ mock }) => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'] })
  const calls: string[][] = []
  const onSearch = (value: string[]) => calls.push(value)
  await render(<SearchBar placeholder="Search" debounce={100} onSearch={onSearch} />)
  const input = host.querySelector('input')!
  const change = async (value: string) => act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await change('old')
  await render(<SearchBar placeholder="Search" debounce={20} onSearch={onSearch} />)
  await act(async () => mock.timers.tick(100))
  assert.deepEqual(calls, [])
  await change('new delay')
  await act(async () => mock.timers.tick(19))
  assert.deepEqual(calls, [])
  await act(async () => mock.timers.tick(1))
  assert.deepEqual(calls, [['new', 'delay']])
})

test('radio prompt stacks options, preserves the selected Python payload and resolves once', async () => {
  const { RadioInput } = await import('../src/framework/visualization/react/ui/prompts/radio_input')
  const payloads: unknown[] = []
  await render(<RadioInput locale="en" title="Choose" description="Pick one"
    items={[{ id: 0, value: 'first', selected: false, onSelect() {} }, { id: 1, value: 'second', selected: false, onSelect() {} }]}
    resolve={payload => payloads.push(payload)} />)
  const group = host.querySelector('[role="radiogroup"]')!
  assert.ok(group.classList.contains('flex-col'), 'radio options must stack')
  assert.ok(group.classList.contains('gap-3'), 'radio options retain prompt spacing')
  const confirm = host.querySelector('button')!
  assert.equal(confirm.disabled, true)
  const radios = host.querySelectorAll('input[type="radio"]')
  assert.equal(radios.length, 2)
  assert.equal(radios[0].getAttribute('name'), radios[1].getAttribute('name'))
  await act(async () => (radios[1] as HTMLInputElement).click())
  assert.equal(confirm.disabled, false)
  await act(async () => confirm.click())
  await act(async () => confirm.click())
  assert.deepEqual(payloads, [{ __type__: 'PayloadString', value: 'second' }])
})

test('packaged font URLs work without the source checkout or node_modules', async () => {
  const { rebasePrismFonts } = await import('../scripts/prism-assets.mjs')
  const filename = 'Nunito-VariableFont_wght.woff2'
  for (const quote of ['', '"', "'"]) {
    const css = `src:url(${quote}../../node_modules/.pnpm/prism@0.2.1/node_modules/@novasoftwarefoundation/prism/fonts/${filename}${quote}) format("woff2")`
    assert.equal(rebasePrismFonts(css), `src:url(./fonts/${filename}) format("woff2")`)
  }
  assert.equal(rebasePrismFonts('url(./fonts/local.woff2)'), 'url(./fonts/local.woff2)')
  assert.throws(() => rebasePrismFonts('url(../../node_modules/unknown/font.woff2)'))
})

test('button adapters pass semantic Prism tones without color-class overrides', async () => {
  const { SecondaryButton, IconLabelButton, LabelButton } = await import('../src/framework/visualization/react/ui/elements/button')
  for (const [node, tone] of [
    [<PrimaryButton label="Donate" tone="success" onClick={() => {}} />, 'success'],
    [<SecondaryButton label="Warn" tone="warning" onClick={() => {}} />, 'warning'],
    [<IconLabelButton label="Delete" icon="delete.svg" tone="danger" onClick={() => {}} />, 'danger'],
    [<LabelButton label="Undo" tone="accent" onClick={() => {}} />, 'accent'],
  ] as const) {
    await render(node)
    const button = host.querySelector('button')!
    assert.ok(button.classList.contains('prism-button'))
    assert.equal(button.classList.contains(`prism-button--${tone}`), tone !== 'accent')
    assert.equal(button.className.includes('bg-'), false)
    assert.equal(button.className.includes('text-'), false)
  }
})

test('button guards accept defaults without requiring an optional tone', async () => {
  const { isPropsUIButtonPrimary, isPropsUIButtonSecundary, isPropsUIButtonIconLabel } = await import('../src/framework/types/elements')
  assert.equal(isPropsUIButtonPrimary({ __type__: 'PropsUIButtonPrimary', label: 'Continue', onClick() {} }), true)
  assert.equal(isPropsUIButtonSecundary({ __type__: 'PropsUIButtonSecundary', label: 'Cancel', tone: 'neutral', onClick() {} }), true)
  assert.equal(isPropsUIButtonIconLabel({ __type__: 'PropsUIButtonIconLabel', label: 'Undo', icon: 'undo.svg', onClick() {} }), true)
})
