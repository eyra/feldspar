# Feldspar

Integration mechanism for developers to build an extension (flow application) that can be hosted on the Next platform. This is for example used in the Port program for data donation, as described below. 

## Digital Trace Data Donation (Port)
More information about the Port program can be found [here](https://eyra.notion.site/Port-Program-4bbf0bbc466547af95f05c609405c4b2?pvs=4). 

Data donation allows researchers to invite participants to share their data download packages (DDPs). However, DDPs potentially contain very sensitive data and often not all data is needed to answer a specific research question. 

Feldspar enables researchers to:
- extract only the data of interest through local processing (on the participants device) using Python (Pyodide)
- prompt participants for questions about the data
- enable participants to inspect the extracted data before donation
- enable participants to delete table rows before donation
- consent or decline to donate the extracted data

Feldspar is open-source under the AGPL license and allows researchers to configure the frontend that guides participants through the data donation steps. 

_Note_: Feldspar is only a frontend. In order for it to be used in a live study, it needs to be hosted on a server and connected to a storage to retrieve the donated data. To run a local instance see [installation](https://github.com/eyra/feldspar/tree/master?tab=readme-ov-file#installation). To create a release for the Next platform or the self hosted version, see [release](https://github.com/eyra/feldspar/tree/master?tab=readme-ov-file#release).

## Installation

In order to start a local instance of Feldspar follow these steps:

0. Prerequisites

   - Fork or clone this repo
   - Install [Node.js](https://nodejs.org/en)
   - Install [Python](https://www.python.org/)
   - Install [Poetry](https://python-poetry.org/)
   - Install [Earthly CLI](https://earthly.dev/get-earthly)

1. Install dependencies & tools:

   ```sh
   cd ./feldspar
   npm install
   npm run prepare
   ```

2. Start the local web server (with hot reloading enabled):

   ```sh
   npm run start
   ```

3. You can now go to the browser: [`http://localhost:3000`](http://localhost:3000).

If the installation went correctly you should be greeted with a mock data donation study.

## Release

1. Create release file:

  ```sh
   npm run release
   ```

2. Use release file:

The generated release.zip file can be installed on the Next platform or the self-hosted version, by adding a "Donate task" and at "Flow application" select the generated zip-file.


## How to use Feldspar?

You can implement your own data donation flow by altering the Python script, which can be used to:

1. customize the participant data donation flow in terms of screen content, type of screen (e.g. a file prompt) and screen order. You can use the Port API ([`props.py`](src/framework/processing/py/port/api/props.py)) for this.
2. extract specific data from the participant DDP that is required for the research question. You can use the data extraction methods that are available in [Pyodide](https://pyodide.org/en/stable/)

A typical script includes the following steps:

1. Prompt the participant to select the DDP file
2. Extract the data of interest from the selected DDP file. Try to aggregate and anonymize as much as possible.
3. Present the extracted data on screen in clear tables to allow the participant to investigate the data that they are about to donate and buttons to choose to either donate or not (consent screen). If a data storage is connected, the extracted data is stored only when participants agree to donate.

Example script: [`script.py`](src/framework/processing/py/port/script.py).

We recommend to use the example script as starting point for your own data donation study.

### Port API examples

Below some examples on how to use the Port API in your `script.py`

<details>
    <summary>Main function</summary>
Every `script.py` should have this function:

```Python
def process(sessionId):
```

This function is a generator of commands by using `yield` statements. No `return` statements should be used.

```Python
def process(sessionId):
    result1 = yield CommandUIRender(page1)
    result2 = yield CommandUIRender(page2)
    # last yield should not expect a result
    yield CommandUIRender(page3)
```

[`ScriptWrapper`](src/framework/processing/py/port/main.py) and [py_worker](src/framework/processing/py_worker.js) using `send` to iterate over the commands one by one. For more information on yield and Generators visit https://realpython.com/introduction-to-python-generators.

</details>

<details>
<summary>API imports</summary>

```Python
from port.api.props as props
from port.api.commands import (CommandUIRender, CommandUIDonate)
```

</details>

<details>
<summary>Create file input</summary>

```Python
platform = "Twitter"
progress = 25

file_input_description = props.Translatable({
    "en": f"Please follow the download instructions and choose the file that you stored on your device.",
    "nl": f"Volg de download instructies en kies het bestand dat u opgeslagen heeft op uw apparaat."
})
allowed_extensions = "application/zip, text/plain"
file_input = props.PropsUIPromptFileInput(file_input_description, allowed_extensions)
```

</details>

<details>
<summary>Create consent tabels</summary>

```Python
import pandas as pd

table1_title = props.Translatable({
    "en": "Title 1",
    "nl": "Titel 1"
})
table1_data = pd.DataFrame(data, columns=["columnX", "columnY", "columnZ"])
table1 = props.PropsUIPromptConsentFormTable("table_1", table1_title, table1_data)

table2_title = props.Translatable({
    "en": "Title 2",
    "nl": "Titel 2"
})
table2_data = pd.DataFrame(data, columns=["columnA", "columnB", "columnC", "columnD"])
table2 = props.PropsUIPromptConsentFormTable("table_2", table2_title, table2_data)

tables = [table1, table1]
# Meta tables currently not supported
meta_tables = []

consent_form = props.PropsUIPromptConsentForm(tables, meta_tables)
```

</details>

<details>
<summary>Create donation screens</summary>

```Python
header = props.PropsUIHeader(title)
footer = props.PropsUIFooter(progress)
body = props.PropsUIPromptFileInput(file_input_description, allowed_extensions)
page = props.PropsUIPageDonation(platform, header, body, footer)
```

</details>

<details>
<summary>Create user input screen with radio buttons</summary>

```Python
header = props.PropsUIHeader(title)
footer = props.PropsUIFooter(progress)
body = props.PropsUIPromptRadioInput(title, description, [{"id": 0, "value": "Selection 1"}, {"id": 1, "value": "Selection 2"}])
page = props.PropsUIPageDonation(platform, header, body, footer)
```

</details>

<details>
<summary>Extract data from input file</summary>

```Python
page = props.PropsUIPageDonation(platform, header, file_input, footer)
result = yield CommandUIRender(page)

# Result is a dictionary (Payload)
if result.__type__ == "PayloadString":
    # File selected
    filename = result.value
    zipfile = zipfile.ZipFile(filename)

    # Extract the data of interest from the selected file
    # Write your own functions for data extraction
    ...
else:
    # No file selected
```

</details>

<details>
<summary>Handle user consent input</summary>

```Python
platform = "Twitter"
donation_key = f"{sessionId}-{platform}"
page = props.PropsUIPageDonation(platform, header, consent_form, footer)
result = yield CommandUIRender(page)

# Response is a dictionary (Payload)
if result.__type__ == "PayloadJSON":
    # User gave consent
    yield CommandSystemDonate(donation_key, result.value)
else:
    # User declined
```

</details>

<details>
<summary>Track user behaviour</summary>

```Python
tracking_key = f"{sessionId}-tracking"
data = "any json string"

# Use the donate command to store tracking data
yield CommandSystemDonate(tracking_key, data)
```

</details>

## Use Feldspar in a data donation study

Feldspar serves as the frontend, providing the application with which participants
engage. It facilitates the flow and logic for data donation. To utilize Feldspar in a
data donation study, it must be hosted on a server capable of storing the
donated data. 

You can host Feldspar on the Next platform or the self-hosted version as explained [here](https://github.com/eyra/feldspar/tree/master?tab=readme-ov-file#release).

Alternatively, you can host Feldspar by embedding it in an
[iframe](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe).
After the iframe loads, send a message that includes a channel. The Feldspar
application will use this channel to relay messages with data ready for storage.
Here's a JavaScript example:

```javascript
// ... wait until the iframe is loaded
const channel = new MessageChannel();
channel.port1.onmessage = (e) => {
  console.log("Message receive from Feldspar app", e);
};
// get the iframe via querySelector or another method
iframe.contentWindow.postMessage("init", "*", [this.channel.port2]);
```

### Data donation as a service

Would you like to get support with setting up your data donation study or host your data donation study on the Next platform? Reach out to Eyra for custom pricing: [connect@eyra.co](mailto:connect@eyra.co?subject='Data donation pricing request'). 

### Example studies

The feldspar repository was previously named port. This repository is now depricated. However, you can check out the [list](https://github.com/eyra/port/wiki/Previous-data-donation-studies) of example studies that were performed using various versions of the port repository as inspiration for your data donation study.

# Technical specifications of Feldspar

If your study requires specific adjustments (new interactive elements etc.), you
have the flexibility to modify the Feldspar functionalities. Leverage the following technical insights to suit your needs.

## Data model

Feldspar uses the following data model (also see: [src/framework/types](src/framework/types))

- [Modules](src/framework/types/modules.ts)

  | Module              | Description                                                |
  | ------------------- | ---------------------------------------------------------- |
  | ProcessingEngine    | Responsible for processing donation flows                  |
  | VisualizationEngine | Responsible for presenting the UI and accepting user input |
  | CommandHandler      | Decoupling of ProcessingEngine and VisualizationEngine     |
  | Bridge              | Callback interface for Bridge Commands (e.g. Donation)    |

- [Pages](src/framework/types/pages.ts)

  | Page         | Description                                                                                         |
  | ------------ | --------------------------------------------------------------------------------------------------- |
  | SplashScreen | First page that is rendered before the Python script is loaded with GDPR consent logic              |
  | Donation     | Page that uses several prompts to get a file from the user and consent to donate the extracted data |
  | End          | Final page with instructions on how to continue                                                     |

- [Prompts](src/framework/types/prompts.ts)

  | Prompt      | Description                                                 |
  | ----------- | ----------------------------------------------------------- |
  | FileInput   | File selection                                              |
  | RadioInput  | Multiple choice question                                    |
  | ConsentForm | Displays extracted data in tables and asks for user consent |
  | Confirm     | General dialog to ask for extra confirmation                |

- [Commands](src/framework/types/commands.ts)

  | Command | Description             |
  | ------- | ----------------------- |
  | Render  | Render the page         |
  | Donate  | Save the extracted data |

  Commands can be send from the Python script using the `yield` keyword.

- [Payloads](src/framework/types/commands.ts)

  | Payload | Description                                                                                                                                                                                                       |
  | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | Void    | Command without user input as a response                                                                                                                                                                          |
  | True    | Positive user input (e.g. Ok button in confirm prompt)                                                                                                                                                            |
  | False   | Negative user input (e.g. Cancel button in confirm prompt)                                                                                                                                                        |
  | Error   | Unexpected problem when handling command                                                                                                                                                                          |
  | String  | String result                                                                                                                                                                                                     |
  | File    | Only used in Javascript. This is intercepted in [py_worker.js](src/framework/processing/py_worker.js) and translated into a String (filename), while the bytes of the file are written to the Pyodide file system |
  | JSON    | User input structured as JSON, used to return the consent data from the consent form                                                                                                                              |

  Payloads are part of a Response back to the Python script after sending commands:

  ```Javascript
  export interface Response {
      __type__: 'Response'
      command: Command
      payload: Payload
  }
  ```

  Responses are intercepted in [py_worker.js](src/framework/processing/py_worker.js) and only the payload is returned to the Python script. Payloads don't have a Python representation in the [API](src/framework/processing/py/port/api) yet. They are translated into a dictionary (default Pyodide behaviour).

## Python-Javascript interoperability

See: [src/framework/processing/py/port](src/framework/processing/py/port)

- [ScriptWrapper](src/framework/processing/py/port/main.py)

  This object is used in [main](src/framework/processing/py/port/main.py) to wrap the `process` generator function in your script. It translates incoming Javascript and outgoing Python commands.

- [API](src/framework/processing/py/port/api)

  - [commands.py](src/framework/processing/py/port/api/commands.py): Defines commands, pages and prompts that are used to communicate from the Python script to the `VisualisationEngine` and `Bridge`.
  - [props.py](src/framework/processing/py/port/api/commands.py): Defines property objects for pages and prompts

## Code instructions

These instructions give you some pointers on things you might like to change or add to Feldspar.

<details>
<summary>Change copy (texts shown on the web pages)</summary>
<br>
The app has two types of copy:

- Dynamic copy: part of the [Python script](src/framework/processing/py/port/script.py)
- Static copy: part of [React components](src/framework/visualisation/react/ui)

Currently two languages are supported (Dutch and English). The Translatable object plays a central role and has a [Python](src/framework/processing/py/port/api/props.py) and a [Typescript](src/framework/types/elements.ts) implementation

From Python code copy can be used as follows:

```Python
from port.api.props import Translatable

copy = Translatable({
    "en": "English text",
    "nl": "Nederlandse tekst"
})
```

In React components copy is handled as follows:

```Typescript
import TextBundle from '../../../../text_bundle'
import { Translator } from '../../../../translator'
import { Translatable } from '../../../../types/elements'

interface Props {
    dynamicCopy: Translatable // from Python script
    locale: string
}

export const MyComponent = ({ dynamicCopy, locale }: Props): JSX.Element => {
    const dynamicText = Translator.translate(dynamicCopy, locale)
    const staticText = Translator.translate(staticCopy(), locale)

    return (
        <>
            <div>{dynamicText}</div>
            <div>{staticText}</div>
        </>
    )
}

const staticCopy = (): Translatable => {
    return new TextBundle()
        .add('en', 'English')
        .add('nl', 'Nederlands')
}
```

</details>

<details>
<summary>Add new prompt</summary>
<br>
Add the properties of the prompt in [src/framework/types/prompts.ts](src/framework/types/prompts.ts) with the following template:

```Typescript
export type PropsUIPrompt =
    PropsUIPromptNew |
    ...

export interface PropsUIPromptNew {
    __type__: 'PropsUIPromptNew'
    title: Text
    description: Text
    ...
}
export function isPropsUIPromptNew (arg: any): arg is PropsUIPromptNew {
    return isInstanceOf<PropsUIPromptNew>(arg, 'PropsUIPromptNew', ['title', 'description', ... ])
}
```

Add the prompt component to [src/framework/visualisation/react/ui/prompts](src/framework/visualisation/react/ui/prompts) with the following template:

```Typescript
import { Weak } from '../../../../helpers'
import { ReactFactoryContext } from '../../factory'
import { PropsUIPromptNew } from '../../../../types/prompts'
import { Translator } from '../../../../translator'
import { Title2, BodyLarge } from '../elements/text'
import { PrimaryButton } from '../elements/button'

type Props = Weak<PropsUIPromptNew> & ReactFactoryContext

export const New = (props: Props): JSX.Element => {
    const { resolve } = props
    const { title, description, continueButton } = prepareCopy(props)

    function handleContinue (): void {
        // Send payload back to script
        resolve?.({ __type__: 'PayloadTrue', value: true })
    }

    return (
        <>
            <Title2 text={title} />
            <BodyLarge text={description} />
            <PrimaryButton label={continueButton} onClick={handleContinue} />
        </>
    )
}

interface Copy {
    title: string
    description: string
    continueButton: string
}

function prepareCopy ({ title, locale }: Props): Copy {
    return {
        title: Translator.translate(title, locale),
        description: Translator.translate(description, locale),
        continueButton: Translator.translate(continueButtonLabel(), locale),
    }
}

const continueButtonLabel = (): Translatable => {
    return new TextBundle()
        .add('en', 'Continue')
        .add('nl', 'Verder')
}
```

</details>

<details>
<summary>Use external Python libraries</summary>
<br>
Python packages are loaded using micropip:

```Python
await micropip.install("https://domain.com/path/to/python.whl", deps=False)
```

Add the above statement to the [py_worker.js](src/framework/processing/py_worker.js) file as follows:

```Javascript
function installPortPackage() {
    console.log('[ProcessingWorker] load port package')
    return self.pyodide.runPythonAsync(`
        import micropip
        await micropip.install("https://domain.com/path/to/python.whl", deps=False)
        await micropip.install("/port-0.0.0-py3-none-any.whl", deps=False)

        import port
    `);
}
```

The standard library is available by default. Please check The Pyodide [docs](https://pyodide.org/en/stable/usage/packages-in-pyodide.html) for other packages you can use.

</details>

<details>
<summary>Implement support for alternative web framework</summary>
<br>
Create a new folder in [src/framework/visualisation](src/framework/visualisation) with a file inside called `engine.ts` to add support for your web framework of choice.

```Typescript
import { VisualisationEngine } from '../../types/modules'
import { Response, CommandUIRender } from '../../types/commands'

export default class MyEngine implements VisualisationEngine {
    locale!: string
    root!: HTMLElement

    start (root: HTMLElement, locale: string): void {
        this.root = root
        this.locale = locale
    }

    async render (command: CommandUIRender): Promise<Response> {
        // Render page and return user input as a response
        ...
    }

    terminate (): void {
        ...
    }
}
```

Change implementation of [assembly.ts](src/framework/assembly.ts) to support your new VisualisationEngine:

```Typescript
import MyEngine from './visualisation/my/engine'
import WorkerProcessingEngine from './processing/worker_engine'
import { VisualisationEngine, ProcessingEngine, Bridge } from './types/modules'
import CommandRouter from './command_router'

export default class Assembly {
    visualisationEngine: VisualisationEngine
    processingEngine: ProcessingEngine
    router: CommandRouter

    constructor (worker: Worker, bridge: Bridge) {
        const sessionId = String(Date.now())
        this.visualisationEngine = new MyEngine()
        this.router = new CommandRouter(system, this.visualisationEngine)
        this.processingEngine = new WorkerProcessingEngine(sessionId, worker, this.router)
    }
}
```

</details>

<details>
<summary>Implement support for alternative script language</summary>
<br>
To support an alternative for Python scripts, create a Javascript file (eg: `my_worker.js`) in [src/framework/processing](src/framework/processing) with the following template:

```Javascript
onmessage = (event) => {
    const { eventType } = event.data
    switch (eventType) {
        case 'initialise':
            // Insert initialisation code here
            self.postMessage({ eventType: 'initialiseDone' })
            break

        case 'firstRunCycle':
            runCycle(null)
            break

        case 'nextRunCycle':
            const { response } = event.data
            runCycle(response.payload)
            break

        default:
            console.log('[ProcessingWorker] Received unsupported event: ', eventType)
    }
}

function runCycle (payload) {
    console.log('[ProcessingWorker] runCycle ' + JSON.stringify(payload))
    // Insert script code here:
    // 1. Handle the payload
    // 2. Create next command, eg:
    nextCommand = new CommandUIRender(new PropsUIPageDonation(...))
    self.postMessage({
        eventType: 'runCycleDone',
        scriptEvent: nextCommand
    })
}
```

Change the implementation of [index.tsx](src/index.tsx) to support your new worker file:

```Typescript
const workerFile = new URL('./framework/processing/my_worker.js', import.meta.url)
```

Make sure to add the worker to the `ts-standard` ignore list in [package.json](package.json):

```JSON
"ts-standard": {
    "ignore": [
        "src/framework/processing/my_worker.js"
    ]
}
```

Note: don't forget to import this new worker file in your server code

</details>

## Testing

1. Automatic

   [Jest](https://jestjs.io) is used as a testing framework. Tests can be found here: [src/test](src/test).

   Run all unit tests:

   ```sh
   npm run dev:test
   ```

2. Manual

   Start the local web server (with hotloading enabled):

   ```sh
   npm run dev:start
   ```

3. Integration with Next

   To run the Port app on top of Next locally see: https://github.com/eyra/mono/blob/d3i/latest/PORT.md

### Technical notes

#### Code generation

Code in [Javascript types](src/framework/types) and [Python api](src/framework/processing/py/port/api/) are currently created by hand. Since both of them are implementions of the same model we will seek the opportunity in the future to define this model in a more abstract way and generate the needed Javascript and Python code accordingly.

#### React

The project is a react app created by [create-react-app](https://create-react-app.dev). This is not set in stone for the future but it was a nice way to speed up the development process in the beginning. Using this strongly opinionated setup hides most of the configuration. It uses [webpack](https://webpack.js.org/concepts) to bundle and serve the app.

#### Code style

The project uses [ts-standard](https://github.com/standard/ts-standard) for managing the code style. This is a TypeScript Style Guide, with linter and automatic code fixer based on StandardJS.

#### Pre-commit hooks

Before committing to github [Husky](https://github.com/typicode/husky) runs all the necessary scripts to make sure the code conforms to `ts-standard`, all the tests run green, and the `dist` folder is up-to-date.

## Funding

Feldspar is part of the Port program for data donation and has been funded by the UU, PDI-SSH ([D3i project](https://datadonation.eu/)), and Eyra.

# Contributing

We want to make contributing to this project as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features

If you have any questions, find any bugs, or have any ideas, read how to contribute [here](https://github.com/eyra/feldspar/blob/master/CONTRIBUTING.md).

