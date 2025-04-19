import port.api.props as props
from port.api.assets import *
from port.api.commands import CommandSystemDonate, CommandSystemExit, CommandUIRender

import pandas as pd
import zipfile
import json
import time


def process(sessionId):
    key = "zip-contents-example"
    meta_data = []
    meta_data.append(("debug", f"{key}: start"))

    # STEP 1: select the file
    data = None
    while True:
        meta_data.append(("debug", f"{key}: prompt file"))
        promptFile = prompt_file("application/zip, text/plain")
        fileResult = yield render_data_submission_page(
            [
                prompt_hello_world(),
                props.PropsUIPromptText(
                    text=props.Translatable(
                        {
                            "en": "Demo",
                            "de": "Demo",
                            "it": "Demo",
                            "nl": "Demo",
                        }
                    )
                ),
                promptFile,
            ]
        )
        if fileResult.__type__ == "PayloadString":
            # Extracting the zipfile
            meta_data.append(("debug", f"{key}: extracting file"))
            extraction_result = []
            zipfile_ref = get_zipfile(fileResult.value)
            print(zipfile_ref, fileResult.value)
            files = get_files(zipfile_ref)
            fileCount = len(files)
            for index, filename in enumerate(files):
                percentage = ((index + 1) / fileCount) * 100
                promptMessage = prompt_extraction_message(
                    f"Extracting file: {filename}", percentage
                )
                yield render_data_submission_page(promptMessage)
                file_extraction_result = extract_file(zipfile_ref, filename)
                extraction_result.append(file_extraction_result)

            if len(extraction_result) >= 0:
                meta_data.append(
                    ("debug", f"{key}: extraction successful, go to consent form")
                )
                data = extraction_result
                break
            else:
                meta_data.append(
                    ("debug", f"{key}: prompt confirmation to retry file selection")
                )
                retry_result = yield render_data_submission_page(retry_confirmation())
                if retry_result.__type__ == "PayloadTrue":
                    meta_data.append(("debug", f"{key}: skip due to invalid file"))
                    continue
                else:
                    meta_data.append(("debug", f"{key}: retry prompt file"))
                    break

    # STEP 2: ask for consent
    meta_data.append(("debug", f"{key}: prompt consent"))
    for prompt in prompt_consent(data):
        result = yield prompt
        if result.__type__ == "PayloadJSON":
            meta_data.append(("debug", f"{key}: donate consent data"))
            meta_frame = pd.DataFrame(meta_data, columns=["type", "message"])
            data_submission_data = json.loads(result.value)
            data_submission_data["meta"] = meta_frame.to_json()
            yield donate(f"{sessionId}-{key}", json.dumps(data_submission_data))
        if result.__type__ == "PayloadFalse":
            value = json.dumps('{"status" : "data_submission declined"}')
            yield donate(f"{sessionId}-{key}", value)


def render_data_submission_page(body):
    header = props.PropsUIHeader(
        props.Translatable(
            {
                "en": "Data data donation demo",
                "de": "Demonstration der Datenspende",
                "it": "Dimostrazione di donazione dei dati",
                "nl": "Data donatie demo",
            }
        )
    )

    # Convert single body item to array if needed
    body_items = [body] if not isinstance(body, list) else body
    page = props.PropsUIPageDataSubmission("Zip", header, body_items)
    return CommandUIRender(page)


def retry_confirmation():
    text = props.Translatable(
        {
            "en": "Unfortunately, we cannot process your file. Continue, if you are sure that you selected the right file. Try again to select a different file.",
            "de": "Leider können wir Ihre Datei nicht bearbeiten. Fahren Sie fort, wenn Sie sicher sind, dass Sie die richtige Datei ausgewählt haben. Versuchen Sie, eine andere Datei auszuwählen.",
            "it": "Purtroppo non possiamo elaborare il tuo file. Continua se sei sicuro di aver selezionato il file corretto. Prova a selezionare un file diverso.",
            "nl": "Helaas, kunnen we uw bestand niet verwerken. Weet u zeker dat u het juiste bestand heeft gekozen? Ga dan verder. Probeer opnieuw als u een ander bestand wilt kiezen.",
        }
    )
    ok = props.Translatable(
        {
            "en": "Try again",
            "de": "Erneut versuchen",
            "it": "Riprova",
            "nl": "Probeer opnieuw",
        }
    )
    cancel = props.Translatable(
        {"en": "Continue", "de": "Weiter", "it": "Continua", "nl": "Verder"}
    )
    return props.PropsUIPromptConfirm(text, ok, cancel)


def prompt_file(extensions):
    description = props.Translatable(
        {
            "en": "Please select a zip file stored on your device.",
            "de": "Bitte wählen Sie eine ZIP-Datei auf Ihrem Gerät aus.",
            "it": "Seleziona un file ZIP memorizzato sul tuo dispositivo.",
            "nl": "Selecteer een ZIP-bestand dat op uw apparaat is opgeslagen.",
        }
    )

    return props.PropsUIPromptFileInput(description, extensions)


def prompt_extraction_message(message, percentage):
    description = props.Translatable(
        {
            "en": "One moment please. Information is now being extracted from the selected file.",
            "de": "Einen Moment bitte. Es werden nun Informationen aus der ausgewählten Datei extrahiert.",
            "it": "Un momento, per favore. Le informazioni vengono estratte dal file selezionato.",
            "nl": "Een moment geduld. Informatie wordt op dit moment uit het geselecteerde bestaand gehaald.",
        }
    )

    return props.PropsUIPromptProgress(description, message, percentage)


def get_zipfile(filename):
    try:
        return zipfile.ZipFile(filename)
    except zipfile.error:
        return "invalid"


def get_files(zipfile_ref):
    try:
        return zipfile_ref.namelist()
    except zipfile.error:
        return []


def extract_file(zipfile_ref, filename):
    try:
        # make it slow for demo reasons only
        time.sleep(0.01)
        info = zipfile_ref.getinfo(filename)
        return (filename, info.compress_size, info.file_size)
    except zipfile.error:
        return "invalid"


def prompt_consent(data):
    table_title = props.Translatable(
        {
            "en": "Zip file contents",
            "de": "Inhalt der ZIP-Datei",
            "it": "Contenuto del file ZIP",
            "nl": "Inhoud van het ZIP-bestand",
        }
    )

    # Show data table if available
    data_table = None
    if data is not None:
        data_frame = pd.DataFrame(data, columns=["filename", "compressed_size", "size"])
        data_table = props.PropsUIPromptConsentFormTable(
            "zip_content",
            1,
            table_title,
            props.Translatable(
                {
                    "en": "The table below shows the contents of the zip file you selected.",
                    "de": "Die Tabelle unten zeigt den Inhalt der ZIP-Datei, die Sie gewählt haben.",
                    "it": "La tabella qui sotto mostra il contenuto del file ZIP che ha scelto.",
                    "nl": "De tabel hieronder laat de inhoud zien van het zip-bestand dat u heeft gekozen.",
                }
            ),
            data_frame,
            headers={
                "compressed_size": props.Translatable(
                    {
                        "en": "Compressed Size",
                        "de": "Komprimierte Größe",
                        "it": "Dimensione compressa",
                        "nl": "Gecomprimeerde grootte",
                    }
                )
            },
        )
    # Another table example
    jokes_table = props.PropsUIPromptConsentFormTable(
        "dad_jokes",
        2,
        props.Translatable(
            {
                "en": "Dad Jokes",
                "de": "Vaterwitze",
                "it": "Barzellette da papà",
                "nl": "Vadergrappen",
            }
        ),
        props.Translatable(
            {
                "en": "This is another table example.",
                "de": "Das ist ein weiteres Tabellenbeispiel.",
                "it": "Questo è un altro esempio di tabella.",
                "nl": "Dit is een ander tabelvoorbeeld.",
            }
        ),
        pd.DataFrame(
            [
                ["I don't always test my code, but when I do, I do it in production."],
                [
                    "There are only two hard things in computer science: cache invalidation and naming things."
                ],
                ["Why do programmers prefer dark mode? Because light attracts bugs."],
                ["I would tell you a joke about UDP, but you probably won't get it."],
                [
                    "A SQL query walks into a bar, walks up to two tables and asks, 'Can I join you?'"
                ],
                ["Why do Java developers wear glasses? Because they don't see sharp."],
            ],
            columns=["joke"],
        ),
    )
    # Show log messages table with data_submission buttons
    result = yield render_data_submission_page(
        [
            item
            for item in [
                data_table,
                jokes_table,
                props.PropsUIPromptText(
                    title=props.Translatable(
                        {
                            "en": "Recursion",
                            "de": "Rekursion",
                            "it": "Ricorsione",
                            "nl": "Recursie",
                        }
                    ),
                    text=props.Translatable(
                        {
                            "en": "To understand what recursion is, you must first understand recursion.",
                            "de": "Um zu verstehen, was Rekursion ist, müssen Sie zuerst Rekursion verstehen.",
                            "it": "Per capire cos'è la ricorsione, devi prima capire la ricorsione.",
                            "nl": "Om te begrijpen wat recursie is, moet je eerst recursie begrijpen.",
                        }
                    ),
                ),
                props.PropsUIDataSubmissionButtons(
                    donate_question=props.Translatable(
                        {
                            "en": "Would you like to donate this data?",
                            "de": "Möchten Sie diese Daten spenden?",
                            "it": "Vuoi donare questi dati?",
                            "nl": "Wilt u deze gegevens doneren?",
                        }
                    ),
                    donate_button=props.Translatable(
                        {"en": "Donate", "de": "Spenden", "it": "Dona", "nl": "Doneren"}
                    ),
                ),
            ]
            if item is not None
        ]
    )
    return result


def donate(key, json_string):
    return CommandSystemDonate(key, json_string)


def exit(code, info):
    return CommandSystemExit(code, info)


def prompt_hello_world():
    return props.PropsUIPromptHelloWorld("Hello World!")
