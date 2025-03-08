import { CommandSystem, CommandSystemDonate, CommandSystemExit, isCommandSystemDonate, isCommandSystemExit } from './framework/types/commands'
import { Bridge } from './framework/types/modules'

export default class FakeBridge implements Bridge {
  send (command: CommandSystem): void {
    if (isCommandSystemDonate(command)) {
      this.handleDataSubmission(command)
    } else if (isCommandSystemExit(command)) {
      this.handleExit(command)
    } else {
      console.log('[FakeBridge] received unknown command: ' + JSON.stringify(command))
    }
  }

  handleDataSubmission (command: CommandSystemDonate): void {
    console.log(`[FakeBridge] received dataSubmission: ${command.key}=${command.json_string}`)
  }

  handleExit (command: CommandSystemExit): void {
    console.log(`[FakeBridge] received exit: ${command.code}=${command.info}`)
  }
}
