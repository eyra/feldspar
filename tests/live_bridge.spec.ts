import { expect, test } from '@playwright/test'
import { MessageChannel } from 'node:worker_threads'
import { LiveBridge } from '../packages/feldspar/src/live_bridge'

test('keeps the newest host channel and fails work on a replaced channel', async () => {
  const firstChannel = new MessageChannel()
  const secondChannel = new MessageChannel()
  let liveInit: ((event: { data: { action: string, locale: string }, ports: MessagePort[] }) => void) | undefined
  let bridge: { send: (command: { __type__: 'CommandSystemDonate', key: string, json_string: string }) => Promise<unknown> } | undefined
  let starts = 0

  try {
    LiveBridge.currentBridge = null
    LiveBridge.create({
      addEventListener: (type: string, listener: typeof liveInit) => {
        expect(type).toBe('message')
        liveInit = listener
      }
    } as unknown as Window, (createdBridge) => {
      bridge = createdBridge
      starts += 1
    })

    liveInit!({ data: { action: 'live-init', locale: 'en' }, ports: [firstChannel.port2] })
    expect(starts).toBe(1)

    const pendingOldDonation = bridge!.send({
      __type__: 'CommandSystemDonate',
      key: 'old',
      json_string: '{}'
    })

    liveInit!({ data: { action: 'live-init', locale: 'nl' }, ports: [secondChannel.port2] })
    expect(starts).toBe(1)
    await expect(pendingOldDonation).resolves.toEqual({
      success: false,
      key: 'old',
      status: 0,
      error: 'Channel re-initialized by host'
    })

    const sentDonation = new Promise<unknown>((resolve) => secondChannel.port1.once('message', resolve))
    const pendingNewDonation = bridge!.send({
      __type__: 'CommandSystemDonate',
      key: 'new',
      json_string: '{}'
    })
    await expect(sentDonation).resolves.toEqual({
      __type__: 'CommandSystemDonate',
      key: 'new',
      json_string: '{}'
    })

    secondChannel.port1.postMessage({ __type__: 'DonateSuccess', key: 'new', status: 201 })
    await expect(pendingNewDonation).resolves.toEqual({ success: true, key: 'new', status: 201 })
  } finally {
    LiveBridge.currentBridge = null
    firstChannel.port1.close()
    firstChannel.port2.close()
    secondChannel.port1.close()
    secondChannel.port2.close()
  }
})
