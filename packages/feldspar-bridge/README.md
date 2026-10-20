# @novasoftwarefoundation/feldspar-bridge

The bridge between a Feldspar app and its host (for example the Next platform). It carries the system commands an app sends to the host: Donate, Event, Exit and Log. It has no dependencies and does not use React or any UI.

## Install

```sh
pnpm add @novasoftwarefoundation/feldspar-bridge
```

ESM only, with TypeScript declarations. Browser code: `LiveBridge` and `LiveHostBridge` use `MessagePort` and `window`.

The package offers two ways to connect:

- `connectBridge()` (since 0.2.0): the whole handshake with the host, and `send` resolves with the host's answer to a donation.
- `LiveBridge.create` and `FakeBridge`: as in 0.1.0, unchanged. Donations are fire-and-forget.

## Use connectBridge

```ts
import { connectBridge } from '@novasoftwarefoundation/feldspar-bridge'

const bridge = await connectBridge()
const answer = await bridge.send({
  __type__: 'CommandSystemDonate',
  key: 'run-1/summary',
  json_string: JSON.stringify({ completed: true }),
})
if (answer?.success === false) console.error('donation failed', answer.status, answer.error)
```

Inside an iframe `connectBridge()`:

1. posts `{ action: 'app-loaded' }` to the parent window, and `{ action: 'resize', height }` now and whenever the body changes size;
2. waits for `live-init` with a `MessagePort`, from the parent window only, for up to `liveInitTimeoutMs` (default 10 000 ms), and rejects after that;
3. sends the event `initialized` on the port (Next shows the app only after it) and resolves with a `LiveHostBridge`.

A later `live-init` moves the bridge to the new port; donations still waiting for an answer are sent again on it. Outside an iframe `connectBridge()` resolves with a `FakeHostBridge`.

`send` resolves a donation with `{ success, key, status, error? }` from `DonateSuccess` or `DonateError` (`status` 0 is a network error). It never rejects and has no time-out of its own: the app decides how long to wait and whether to retry with the same key. A late answer for a key settles every send still waiting for that key; a `DonateError` does so only once no other send for the key is unanswered, so a retry is not ended by the error of the attempt before it. Other commands resolve with `undefined` once posted.

`connectBridge({ acknowledges: false })` is a fallback for a host that does not answer: donations resolve with `undefined` once posted, and a `DonateError` that arrives anyway is logged.

The bridge logs the steps of the handshake (prefix `[connectBridge]`), malformed answers and failed donations it cannot return, but not each donation it sends, nor messages of other sources.

## Use LiveBridge.create

```ts
import { LiveBridge, FakeBridge } from '@novasoftwarefoundation/feldspar-bridge'
import type { Bridge, CommandSystemDonate } from '@novasoftwarefoundation/feldspar-bridge'

function start(bridge: Bridge) {
  const donation: CommandSystemDonate = {
    __type__: 'CommandSystemDonate',
    key: 'run-1/summary',
    json_string: JSON.stringify({ completed: true }),
  }
  bridge.send(donation)
}

if (import.meta.env.PROD) {
  // The host sends a `live-init` message with a MessagePort and the locale.
  LiveBridge.create(window, (bridge, locale) => start(bridge))
} else {
  start(new FakeBridge()) // posts donations to /data-submission of the dev server
}
```

## API

| Export | Purpose |
| --- | --- |
| `Bridge` | Interface: `send(command)` and `sendLogs(entries)`. |
| `CommandSystemDonate`, `CommandSystemEvent`, `CommandSystemExit`, `CommandSystemLog`, `CommandSystem` | Command types. |
| `isCommandSystem`, `isCommandSystemDonate`, `isCommandSystemEvent`, `isCommandSystemExit`, `isCommandSystemLog` | Type guards. A guard returns `false` for another command type and throws when the matching type lacks a required property. |
| `LiveBridge` | Sends commands to the host over a `MessageChannel` port. `LiveBridge.create(window, callback)` waits once for the host's `live-init` message. |
| `FakeBridge` | Local development: logs commands and posts donations as `{ key, data }` to `/data-submission`. |
| `LogEntry`, `LogLevel` | Types used by `Bridge.sendLogs`. |
| `connectBridge(options?)` | Since 0.2.0. The handshake with the host; resolves with a `HostBridge`. Options: `acknowledges` (default `true`), `liveInitTimeoutMs` (default `LIVE_INIT_TIMEOUT_MS`, 10 000), `window`. |
| `HostBridge`, `HostBridgeOptions`, `ConnectOptions`, `HostWindow` | Since 0.2.0. `HostBridge`: `acknowledges` and `send(command)`, which resolves with the answer to a donation. |
| `LiveHostBridge` | Since 0.2.0. A `HostBridge` on a `MessagePort`, with the `locale` from `live-init` and `replacePort(port)`. Usually created by `connectBridge`. |
| `FakeHostBridge`, `KEEPALIVE_MAX_BYTES` | Since 0.2.0. Local development: posts donations as `{ key, data }` to `/data-submission` (option `url`) and answers like Next: success for HTTP 2xx, an error with the status otherwise, 0 for a network error. Uses `keepalive` while the requests in flight stay within 64 KiB. |
| `DonateSuccess`, `DonateError`, `ResponseSystemDonate`, `isDonateAnswer` | Since 0.2.0. The host's answers to a donation and what `HostBridge.send` resolves with. |
| `reportSize(window)` | Since 0.2.0. Posts the app's height to the host, now and on each resize; returns a function that stops it. `connectBridge` calls it. |

## Behaviour to know

- With `LiveBridge` and `FakeBridge`, Donate is fire-and-forget: `send` returns nothing and the bridge does not receive a reply from the host. Use `connectBridge` for the replies.
- A donation has a `key` and a `json_string`. The host decides what the same key twice means; Next overwrites it.

## Releasing

Tag `feldspar-bridge/vX.Y.Z` (equal to `version` in `package.json`). CI publishes it when publishing is enabled for the repository.
