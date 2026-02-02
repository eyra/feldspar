import { Command, Response, isCommandSystem, isCommandSystemDonate, isCommandSystemExit, isCommandUI, CommandUI, CommandSystem } from './types/commands'
import { CommandHandler, Bridge, ResponseSystemDonate } from './types/modules'
import ReactEngine from './visualization/react/engine'

export default class CommandRouter implements CommandHandler {
  bridge: Bridge
  visualizationEngine: ReactEngine

  constructor (bridge: Bridge, visualizationEngine: ReactEngine) {
    this.bridge = bridge
    this.visualizationEngine = visualizationEngine
  }

  async onCommand (command: Command): Promise<Response> {
    if (isCommandSystem(command)) {
      return this.onCommandSystem(command)
    } else if (isCommandUI(command)) {
      return this.onCommandUI(command)
    } else {
      throw new TypeError('[CommandRouter] Unknown command' + JSON.stringify(command))
    }
  }

  async onCommandSystem (command: CommandSystem): Promise<Response> {
    // For donate commands, wait for the actual result
    if (isCommandSystemDonate(command)) {
      const result = await this.bridge.send(command) as ResponseSystemDonate
      console.log('[CommandRouter] Donate result:', result)
      return {
        __type__: 'Response',
        command,
        payload: {
          __type__: 'PayloadResponseSystemDonate',
          value: result
        }
      }
    }

    // For other system commands
    await this.bridge.send(command)

    if (isCommandSystemExit(command)) {
      console.log('[CommandRouter] Application exit')
    }

    return { __type__: 'Response', command, payload: { __type__: 'PayloadVoid', value: undefined } }
  }

  async onCommandUI (command: CommandUI): Promise<Response> {
    try {
      const response = await this.visualizationEngine.render(command)
      if (!response || !response.__type__) {
        console.error('[CommandRouter] Invalid response:', response)
        return {
          __type__: 'Response',
          command,
          payload: { __type__: 'PayloadVoid', value: undefined }
        }
      }
      return response
    } catch (error) {
      console.error('[CommandRouter] Error:', error)
      return {
        __type__: 'Response',
        command,
        payload: { __type__: 'PayloadVoid', value: undefined }
      }
    }
  }
}
