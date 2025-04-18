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
- Install [Python](https://www.python.org/) (Version 3.11 or higher)
- Install [Poetry](https://python-poetry.org/)
- Install [Earthly CLI](https://earthly.dev/get-earthly)

### Installation

1. Install dependencies:

   ```sh
   npm install
   ```

2. Run the project locally with hot reloading (builds Python package and starts the development server):

   ```sh
   npm run start
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

## Funding

Feldspar is part of the Port program for data donation and has been funded by the UU, PDI-SSH ([D3i project](https://datadonation.eu/)), and [Eyra](https://www.eyra.co/).

## Contributing

We welcome contributions to make Feldspar better. Please read our [contributing guidelines](https://github.com/eyra/feldspar/blob/master/CONTRIBUTING.md) for details on how to submit issues, feature requests, and pull requests.

<!-- Original detailed API examples and technical specifications can be included here -->
