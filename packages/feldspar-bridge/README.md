# @novasoftwarefoundation/feldspar-bridge

The bridge between a Feldspar app and its host (for example the Next platform). It carries the system commands an app sends to the host: Donate, Event, Exit and Log. It has no dependencies and does not use React or any UI.

## Install

```sh
pnpm add @novasoftwarefoundation/feldspar-bridge
```

ESM only, with TypeScript declarations. Browser code: `LiveBridge` uses `MessagePort` and `window`.

## Use

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

## Behaviour to know

- Donate is fire-and-forget: `send` returns nothing and the bridge does not receive a reply from the host. Replies (success or error) are not part of this version.
- A donation has a `key` and a `json_string`. The host decides what the same key twice means.

## Releasing

Tag `feldspar-bridge/vX.Y.Z` (equal to `version` in `package.json`). CI publishes it when publishing is enabled for the repository.
