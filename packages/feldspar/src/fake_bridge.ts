import { CommandSystem, CommandSystemDonate, CommandSystemExit, isCommandSystemDonate, isCommandSystemExit, isCommandSystemLog } from './framework/types/commands'
import { Bridge } from './framework/types/modules'
import { LogEntry } from './framework/logging'

export default class FakeBridge implements Bridge {
  send (command: CommandSystem): void {
    if (isCommandSystemDonate(command)) {
      this.handleDataSubmission(command)
    } else if (isCommandSystemExit(command)) {
      this.handleExit(command)
    } else if (isCommandSystemLog(command)) {
      console.log('[FakeBridge] received log command: ' + JSON.stringify(command))
    } else {
      console.log('[FakeBridge] received unknown command: ' + JSON.stringify(command))
    }
  }

  async handleDataSubmission (command: CommandSystemDonate): Promise<void> {
    console.log(`[FakeBridge] received dataSubmission: ${command.key}=${command.json_string}`);
    // Post the data, this allows testing the data submission
    try {
      const response = await fetch('/data-submission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({key: command.key, data: command.json_string}),
      });

      if (!response.ok) {
        console.error(`[FakeBridge] Data submission failed with status: ${response.status}`);
      } else {
        console.log(`[FakeBridge] Data submission succeeded with status: ${response.status}`);
      }
    } catch (error) {
      console.error(`[FakeBridge] Error during data submission:`, error);
    }
  }

  handleExit (command: CommandSystemExit): void {
    console.log(`[FakeBridge] received exit: ${command.code}=${command.info}`)
  }

  sendLogs (entries: LogEntry[]): void {
    entries.forEach(entry => {
      console.log(`[FakeBridge] Sending CommandSystemLog:`, {
        __type__: 'CommandSystemLog',
        json_string: JSON.stringify(entry),
      })
    })
  }
}
