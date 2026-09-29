# Feldspar

Feldspar is an integration mechanism for building data donation applications that can be hosted on the [Next](https://next.eyra.co/) platform. It enables researchers to create custom data extraction and donation flows using Python and React.

## Digital Trace Data Donation (Port)

More information about the Port program can be found [here](https://eyra.notion.site/Port-Program-4bbf0bbc466547af95f05c609405c4b2?pvs=4).

Feldspar enables researchers to:

- Extract only the data of interest through local processing (on the participant's device) using Python (Pyodide)
- Prompt participants for questions about the data
- Enable participants to inspect the extracted data before donation
- Enable participants to delete table rows before donation
- Consent or decline to donate the extracted data

## Getting Started

### Prerequisites

- Fork or clone this repo
- Install [Node.js](https://nodejs.org/en)
- Install [pnpm](https://pnpm.io/installation) (Fast, disk space efficient package manager)
- Install [Python](https://www.python.org/) (Version 3.11 or higher)
- Install [Poetry](https://python-poetry.org/)
- Install [Earthly CLI](https://earthly.dev/get-earthly)

### Installation

1. Install dependencies:

   ```sh
   pnpm install
   ```

2. Run the project locally with hot reloading (builds Python package and starts the development server):

   ```sh
   pnpm run start
   ```

3. Access the application at [http://localhost:3000](http://localhost:3000)

## Customizing the Python Code

The core of Feldspar's functionality is in the Python script at `packages/python/port/script.py`. This script defines the flow of the data donation process.

### Basic Structure

1. Fork the repository to create your own version
2. Navigate to `packages/python/port/script.py`
3. Modify the `process(sessionId)` function to customize your data donation flow

A basic donation flow typically includes:

1. Prompt the participant to select a file
2. Extract relevant data from the file
3. Present the extracted data in a consent form
4. Process the participant's consent decision

### Example: Modifying the File Selection Screen

```python
def prompt_file(extensions):
    description = props.Translatable({
        "en": "Please select your data export file.",
        "de": "Bitte wählen Sie Ihre Datenexportdatei aus.",
        "it": "Seleziona il tuo file di esportazione dati.",
        "es": "Por favor, seleccione su archivo de exportación de datos.",
        "nl": "Selecteer uw data-exportbestand."
    })
    return props.PropsUIPromptFileInput(description, extensions)
```

### Working with Assets

Add any static assets your script needs to `packages/python/port/assets/`. Access them in your script:

```python
from port.api.assets import *

def process(sessionId):
    # Path to an asset
    path = asset_path("my_file.txt")

    # Open an asset directly
    file = open_asset("my_file.txt")

    # Read asset contents
    content = read_asset("my_file.txt")
```

### Dataframe limits and worker memory

`PropsUIPromptConsentFormTable` defaults to 10,000 rows. Set
`data_frame_max_size` to another row limit, or explicitly use `None` to retain
all rows. The UI no longer silently truncates tables at 50,000 rows: review and
donation use the rows supplied by the script, minus participant deletions.
Scripts must choose limits appropriate for their data, devices and host upload
limits; an unlimited table is not a browser-memory guarantee.

Serialized command strings cross the worker boundary as transferable UTF-8
buffers and are decoded before UI handling. Responses return only their payload,
not the original command, and transferred Python command proxies are released.
Public script dictionaries and host donation JSON are unchanged. The Python
wheel, worker and framework must be deployed together because the internal
transport protocol changed.

Fatal worker errors are forwarded to monitoring before Feldspar sends one
`CommandSystemExit` with code `1` and stops the worker. The exit explanation uses
the participant's locale, without exposing error details. `MemoryError`, the
observed pandas `OverflowError` messages (`Could not reserve memory block` and
`Maximum recursion level reached`), and WASM `memory access out of bounds` failures
use: “Data processing failed. The data may be too large to process on this device.”
Other fatal errors use: “Data processing failed.” Both messages are translated
into the seven supported languages.

Late worker events and pending UI responses cannot resume processing after failure.
Error-level script logs do not themselves end the flow; handled errors can still
use script-defined retries. The host owns recovery; Feldspar does not restart the
failed runtime or add a retry UI.

### Reproducing large-donation memory use

The normal demo extracts each JSON file's `user.name` into its JSON-summary table.
Use the dedicated fixture generator to exercise that real upload, extraction,
review and donation path. Unlike a large ZIP of unselected content, these values
actually reach the donated table. No Python or worker code is substituted.

```sh
python3 tests/generate_memory_zip.py /tmp/feldspar-memory.zip --mib 192 --files 256
pnpm run build
pnpm --filter @eyra/data-collector exec vite preview --host 127.0.0.1 --port 4173
```

In another terminal:

```sh
node tests/memory-benchmark.cjs http://127.0.0.1:4173/ /tmp/feldspar-memory.zip
```

The fixture contains synthetic data only, uses exclusive creation, and compresses
well. `--mib` controls total donated `User` text, not ZIP size; JSON and the other
demo tables add overhead. Start with `--mib 64` for a smaller comparison.

The opt-in benchmark opens headed Chromium, uploads the ZIP, deletes and restores
a JSON-summary row, donates through the real host bridge, and checks every
summary row's text, order and metadata. Its local receiver does not upload to
Next. It samples the dedicated Chromium process tree's RSS every 250 ms using
`ps` (macOS/Linux), reporting phase peaks, completion or failure, and donation
bytes. RSS includes shared pages and is not unique physical memory or JS heap;
sampling can miss brief peaks. Compare the same fixture against production builds
of the base and changed branches sequentially on the same machine. A crash is
reported as a failure, not a completed low-memory run. This heavyweight benchmark
is deliberately outside the default browser test suite.

### Local extraction debugging (CLI)

You can run the extraction locally against a real zip file — no browser or Pyodide needed:

```bash
cd packages/python
poetry run python -m port.script path/to/file.zip
```

This drives `extract_data()` directly and prints each extracted table to the terminal. Useful for quickly verifying that your extraction logic works before testing it in the browser.

### Adding Dependencies

If you need additional Python packages, add them to `packages/python/pyproject.toml` in the `tool.poetry.dependencies` section.

## Adding New Visual Components (Advanced)

Feldspar allows you to add custom UI components that can be used in your Python script. This is a more advanced feature that requires understanding both Python and React.

### Step 1: Define Component Types

Create a new folder in `packages/data-collector/src/components/my_component/` and add a `types.ts` file:

```typescript
export interface PropsUIPromptMyComponent {
  __type__: "PropsUIPromptMyComponent";
  title: string;
  // Add any other properties your component needs
}
```

### Step 2: Create React Component

Add a `component.tsx` file to implement your component:

```typescript
import React from "react";
import { PropsUIPromptMyComponent } from "./types";
import { ReactFactoryContext } from "@eyra/feldspar";

type Props = PropsUIPromptMyComponent & ReactFactoryContext;

export const MyComponent: React.FC<Props> = ({ title, resolve }) => {
  return (
    <div>
      <h1>{title}</h1>
      <button
        onClick={() => resolve?.({ __type__: "PayloadTrue", value: true })}
      >
        Continue
      </button>
    </div>
  );
};
```

### Step 3: Create Component Factory

Add a new file at `packages/data-collector/src/factories/my_component.tsx`:

```typescript
import { PromptFactory, ReactFactoryContext } from "@eyra/feldspar";
import React from "react";
import { MyComponent } from "../components/my_component/component";
import { PropsUIPromptMyComponent } from "../components/my_component/types";

export class MyComponentFactory implements PromptFactory {
  create(body: unknown, context: ReactFactoryContext) {
    if (this.isMyComponent(body)) {
      return <MyComponent {...body} {...context} />;
    }
    return null;
  }

  private isMyComponent(body: unknown): body is PropsUIPromptMyComponent {
    return (
      (body as PropsUIPromptMyComponent).__type__ === "PropsUIPromptMyComponent"
    );
  }
}
```

### Step 4: Register Your Component

Update `packages/data-collector/src/App.tsx` to include your new factory:

```typescript
import { DataSubmissionPageFactory, ScriptHostComponent } from "@eyra/feldspar";
import { HelloWorldFactory } from "./factories/hello_world";
import { MyComponentFactory } from "./factories/my_component";

function App() {
  return (
    <div className="App">
      <ScriptHostComponent
        workerUrl="./py_worker.js"
        standalone={process.env.NODE_ENV !== "production"}
        factories={[
          new DataSubmissionPageFactory({
            promptFactories: [
              new HelloWorldFactory(),
              new MyComponentFactory(), // Add your new factory here
            ],
          }),
        ]}
      />
    </div>
  );
}

export default App;
```

### Step 5: Use Your Component in Python

Add a class to your `script.py` to create your component:

```python
from dataclasses import dataclass

@dataclass
class PropsUIPromptMyComponent:
    title: str

    def toDict(self):
        dict = {}
        dict["__type__"] = "PropsUIPromptMyComponent"
        dict["title"] = self.title
        return dict

def process(sessionId):
    result = yield render_data_submission_page(
        PropsUIPromptMyComponent("My Custom Component")
    )
    # Handle the result...
```

## Creating a Release

When your data donation application is ready for deployment:

1. Create a release package:

   ```sh
   ./release.sh
   ```

2. Find the generated ZIP file in the `releases/` directory, named with the current date and sequential number (e.g., `feldspar_2023-07-15_1.zip`)

3. This ZIP file can be deployed to:
   - The Next platform
   - A self-hosted environment
   - Any server that can host static files and store the donated data

To use the release in the Next platform, add a "Donate task" and select the generated ZIP file as the "Flow application".

## Important Disclaimer

Please review the [disclaimer](./DISCLAIMER.md) in this repository for important information about technical limitations, logging behavior, and data handling considerations.

## Funding

Feldspar is part of the Port program for data donation and has been funded by the UU, PDI-SSH ([D3i project](https://datadonation.eu/)), and [Eyra](https://www.eyra.co/).

## Contributing

We welcome contributions to make Feldspar better. Please read our [contributing guidelines](https://github.com/eyra/feldspar/blob/master/CONTRIBUTING.md) for details on how to submit issues, feature requests, and pull requests.

<!-- Original detailed API examples and technical specifications can be included here -->
