import {
  isCommandSystem,
  isCommandSystemDonate,
  isCommandSystemEvent,
  isCommandSystemExit,
  isCommandSystemLog,
} from './index.js'

describe('command guards', () => {
  const donate = { __type__: 'CommandSystemDonate', key: 'run1/summary', json_string: '{"a":1}' }
  const event = { __type__: 'CommandSystemEvent', name: 'loaded' }
  const exit = { __type__: 'CommandSystemExit', code: 0, info: 'done' }
  const log = { __type__: 'CommandSystemLog', level: 'info', message: 'hi', json_string: '{}' }

  it('recognises each system command by its own guard only', () => {
    expect(isCommandSystemDonate(donate)).toBe(true)
    expect(isCommandSystemEvent(event)).toBe(true)
    expect(isCommandSystemExit(exit)).toBe(true)
    expect(isCommandSystemLog(log)).toBe(true)
    expect(isCommandSystemDonate(event)).toBe(false)
    expect(isCommandSystemExit(donate)).toBe(false)
  })

  it('accepts all four commands as CommandSystem and rejects other values', () => {
    for (const command of [donate, event, exit, log]) expect(isCommandSystem(command)).toBe(true)
    expect(isCommandSystem({ __type__: 'CommandUIRender', page: {} })).toBe(false)
    expect(isCommandSystem(null)).toBe(false)
    expect(isCommandSystem(undefined)).toBe(false)
    expect(isCommandSystem('CommandSystemDonate')).toBe(false)
  })

  it('accepts an empty json_string and code 0 (falsy but defined)', () => {
    expect(isCommandSystemDonate({ ...donate, json_string: '' })).toBe(true)
    expect(isCommandSystemExit({ ...exit, code: 0 })).toBe(true)
  })

  it('throws when a Donate command lacks a required property', () => {
    expect(() => isCommandSystemDonate({ __type__: 'CommandSystemDonate', key: 'k' })).toThrow('json_string')
  })
})
