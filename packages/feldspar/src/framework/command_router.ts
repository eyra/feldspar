import { Command, Response, isCommandSystem, isCommandSystemExit, isCommandUI, CommandUI, CommandSystem } from './types/commands'
import { CommandHandler, Bridge } from './types/modules'
import ReactEngine from './visualization/react/engine'

export default class CommandRouter implements CommandHandler {
  bridge: Bridge
  visualizationEngine: ReactEngine

  constructor (bridge: Bridge, visualizationEngine: ReactEngine) {
    this.bridge = bridge
    this.visualizationEngine = visualizationEngine
  }

  async onCommand (command: Command): Promise<Response> {
    return await new Promise<Response>((resolve, reject) => {
      if (isCommandSystem(command)) {
        this.onCommandSystem(command, resolve)
      } else if (isCommandUI(command)) {
        this.onCommandUI(command, resolve)
      } else {
        reject(new TypeError('[CommandRouter] Unknown command' + JSON.stringify(command)))
      }
    })
  }

  onCommandSystem (command: CommandSystem, resolve: (response: Response) => void): void {
    this.bridge.send(command)

    if (isCommandSystemExit(command)) {
      console.log('[CommandRouter] Application exit')
    } else {
      resolve({ __type__: 'Response', command, payload: { __type__: 'PayloadVoid', value: undefined } })
    }
  }

  onCommandUI (command: CommandUI, resolve: (response: Response) => void): void {
    this.visualizationEngine.render(command)
      .then((response) => {
        if (!response || !response.__type__) {
          console.error('[CommandRouter] Invalid response:', response);
          resolve({ 
            __type__: 'Response', 
            command, 
            payload: { __type__: 'PayloadVoid', value: undefined } 
          });
        } else {
          resolve(response);
        }
      })
      .catch((error) => {
        console.error('[CommandRouter] Error:', error);
        resolve({ 
          __type__: 'Response', 
          command, 
          payload: { __type__: 'PayloadVoid', value: undefined } 
        });
      });
  }
}
