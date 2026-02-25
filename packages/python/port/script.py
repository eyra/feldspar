# --------------------------------------------------------------------
# Note to developers:
#
# This script (`script.py`) provides a basic data donation flow using
# standard UI components available in Feldspar.
#
# For a more advanced example that includes custom UI components
# (e.g. a custom React-based component integrated with Python),
# please refer to:
#
#     `script_custom_ui.py`
#
# That script demonstrates how to define and use your own components
# using Feldspar’s React integration and how to render them via Python.
# --------------------------------------------------------------------

import port.api.props as props
from port.api.assets import *
from port.api.commands import CommandSystemDonate, CommandSystemExit, CommandSystemLog, CommandUIRender

import pandas as pd
import zipfile
import json
import time


def donate(key, data):
    return CommandSystemDonate(key=key, json_string=data)

def log(level, message):
    return CommandSystemLog(level=level, message=message)

def process(sessionId):
    yield log("info", "user entered script")

    key = "zip-contents-example"
    yield log("debug", f"{key}: start")

    # STEP 1: select the file
    data = None
    while True:
        yield log("debug", f"{key}: prompt file")
        promptFile = prompt_file("application/zip, text/plain")
        fileResult = yield render_data_submission_page([promptFile])

        if fileResult.__type__ == "PayloadFile":
            yield log("debug", f"{key}: extracting file")
            try:
                zipfile_ref = zipfile.ZipFile(fileResult.value)
            except zipfile.error as e:
                yield log("error", f"{key}: error opening zipfile: {e}")
                zipfile_ref = "invalid"

            if zipfile_ref and zipfile_ref != "invalid":
                # Extracting the zipfile
                extraction_result = []
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
                    yield log("debug", f"{key}: extraction successful, go to consent form")
                    data = extraction_result
                    break
                else:
                    yield log("debug", f"{key}: prompt confirmation to retry file selection")
                    retry_result = yield render_data_submission_page(retry_confirmation())
                    if retry_result.__type__ == "PayloadTrue":
                        yield log("debug", f"{key}: skip due to invalid file")
                        continue
                    else:
                        yield log("debug", f"{key}: retry prompt file")
                        break
            else:
                # Invalid file, ask for retry
                yield log("debug", f"{key}: prompt confirmation to retry file selection")
                retry_result = yield render_data_submission_page(retry_confirmation())
                if retry_result.__type__ == "PayloadTrue":
                    yield log("debug", f"{key}: skip due to invalid file")
                    continue
                else:
                    yield log("debug", f"{key}: retry prompt file")
                    break

    # STEP 2: ask for consent
    yield log("debug", f"{key}: prompt consent")
    for prompt in prompt_consent(data):
        result = yield prompt
        if result.__type__ == "PayloadJSON":
            yield log("debug", f"{key}: donate consent data")
            yield donate(f"{sessionId}-{key}", result.value)
        if result.__type__ == "PayloadFalse":
            value = json.dumps('{"status" : "data_submission declined"}')
            yield donate(f"{sessionId}-{key}", value)


def render_data_submission_page(body):
    header = props.PropsUIHeader(
        props.Translatable(
            {
                "en": "Data donation flow example",
                "de": "Beispiel für einen Datenspende-Ablauf",
                "it": "Esempio di flusso di donazione dei dati",
                "es": "Ejemplo de flujo de donación de datos",
                "nl": "Voorbeeld van een datadonatieproces",
                "ro": "Exemplu de flux de donație a datelor",
                "lt": "Duomenų dovanojimo srauto pavyzdys",
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
            "es": "Lamentablemente, no podemos procesar su archivo. Continúe si está seguro de que ha seleccionado el archivo correcto. Intente seleccionar un archivo diferente.",
            "nl": "Helaas, kunnen we uw bestand niet verwerken. Weet u zeker dat u het juiste bestand heeft gekozen? Ga dan verder. Probeer opnieuw als u een ander bestand wilt kiezen.",
            "ro": "Din păcate, nu putem procesa fișierul dvs. Continuați dacă sunteți sigur că ați selectat fișierul corect. Încercați din nou pentru a selecta un fișier diferit.",
            "lt": "Deja, negalime apdoroti jūsų failo. Tęskite, jei esate tikri, kad pasirinkote tinkamą failą. Bandykite dar kartą pasirinkti kitą failą.",
        }
    )
    ok = props.Translatable(
        {
            "en": "Try again",
            "de": "Erneut versuchen",
            "it": "Riprova",
            "es": "Inténtelo de nuevo",
            "nl": "Probeer opnieuw",
            "ro": "Încercați din nou",
            "lt": "Bandykite dar kartą",
        }
    )
    cancel = props.Translatable(
        {
            "en": "Continue",
            "de": "Weiter",
            "it": "Continua",
            "es": "Continuar",
            "nl": "Verder",
            "ro": "Continuați",
            "lt": "Tęsti",
        }
    )
    return props.PropsUIPromptConfirm(text, ok, cancel)


def prompt_file(extensions):
    description = props.Translatable(
        {
            "en": "Please select a zip file stored on your device.",
            "de": "Bitte wählen Sie eine ZIP-Datei auf Ihrem Gerät aus.",
            "it": "Seleziona un file ZIP memorizzato sul tuo dispositivo.",
            "es": "Por favor, seleccione un archivo ZIP guardado en su dispositivo.",
            "nl": "Selecteer een ZIP-bestand dat op uw apparaat is opgeslagen.",
            "ro": "Vă rugăm să selectați un fișier ZIP stocat pe dispozitivul dvs.",
            "lt": "Prašome pasirinkti ZIP failą, saugomą jūsų įrenginyje.",
        }
    )





    return props.PropsUIPromptFileInput(description, extensions)


def prompt_extraction_message(message, percentage):
    description = props.Translatable(
        {
            "en": "One moment please. Information is now being extracted from the selected file.",
            "de": "Einen Moment bitte. Es werden nun Informationen aus der ausgewählten Datei extrahiert.",
            "it": "Un momento, per favore. Le informazioni vengono estratte dal file selezionato.",
            "es": "Un momento, por favor. Se están extrayendo los datos del archivo seleccionado.",
            "nl": "Een moment geduld. Informatie wordt op dit moment uit het geselecteerde bestand gehaald.",
            "ro": "Un moment, vă rugăm. Informațiile sunt extrase acum din fișierul selectat.",
            "lt": "Prašome palaukti. Informacija dabar ištraukiama iš pasirinkto failo.",
        }
    )

    return props.PropsUIPromptProgress(description, message, percentage)


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
    description = props.PropsUIPromptText(
        text=props.Translatable(
            {
                "en": "Please review your data below. Use the search fields to find specific information. You can remove any data you prefer not to share. Thank you for supporting this research project!",
                "de": "Bitte überprüfen Sie Ihre Daten unten. Verwenden Sie die Suchfelder, um bestimmte Informationen zu finden. Sie können alle Daten entfernen, die Sie nicht teilen möchten. Vielen Dank für Ihre Unterstützung dieses Forschungsprojekts!",
                "it": "Controlla i tuoi dati qui sotto. Usa i campi di ricerca per trovare informazioni specifiche. Puoi rimuovere qualsiasi dato che preferisci non condividere. Grazie per il tuo supporto a questo progetto di ricerca!",
                "es": "Revise sus datos a continuación. Utilice los campos de búsqueda para encontrar información específica. Puede eliminar cualquier dato que prefiera no compartir. ¡Gracias por apoyar este proyecto de investigación!",
                "nl": "Bekijk hieronder uw gegevens. Gebruik de zoekvelden om specifieke informatie te vinden. U kunt gegevens verwijderen die u liever niet deelt. Bedankt voor uw steun aan dit onderzoeksproject!",
                "ro": "Vă rugăm să revizuiți datele de mai jos. Folosiți câmpurile de căutare pentru a găsi informații specifice. Puteți elimina orice date pe care preferați să nu le partajați. Vă mulțumim că sprijiniți acest proiect de cercetare!",
                "lt": "Prašome peržiūrėti savo duomenis žemiau. Naudokite paieškos laukus, kad rastumėte konkrečią informaciją. Galite pašalinti bet kokius duomenis, kurių nenorite bendrinti. Ačiū, kad remiate šį tyrimų projektą!",
            }
        )
    )

    table_title = props.Translatable(
        {
            "en": "Zip file contents",
            "de": "Inhalt der ZIP-Datei",
            "it": "Contenuto del file ZIP",
            "es": "Contenido del archivo ZIP",
            "nl": "Inhoud van het ZIP-bestand",
            "ro": "Conținutul fișierului ZIP",
            "lt": "ZIP failo turinys",
        }
    )

    # Show data table if extracted data is available
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
                    "es": "La tabla a continuación muestra el contenido del archivo ZIP que ha seleccionado.",
                    "nl": "De tabel hieronder laat de inhoud zien van het zip-bestand dat u heeft gekozen.",
                    "ro": "Tabelul de mai jos arată conținutul fișierului ZIP pe care l-ați selectat.",
                    "lt": "Žemiau esanti lentelė rodo pasirinkto ZIP failo turinį.",
                }
            ),
            data_frame,
            headers={
                "filename": props.Translatable(
                    {
                        "en": "Filename",
                        "de": "Dateiname",
                        "it": "Nome del file",
                        "es": "Nombre del archivo",
                        "nl": "Bestandsnaam",
                        "ro": "Numele fișierului",
                        "lt": "Failo pavadinimas",
                    }
                ),
                "compressed_size": props.Translatable(
                    {
                        "en": "Compressed Size",
                        "de": "Komprimierte Größe",
                        "it": "Dimensione compressa",
                        "es": "Tamaño comprimido",
                        "nl": "Gecomprimeerde grootte",
                        "ro": "Dimensiune comprimată",
                        "lt": "Suspaustas dydis",
                    }
                ),
                "size": props.Translatable(
                    {
                        "en": "Uncompressed Size",
                        "de": "Dekomprimierte Größe",
                        "it": "Dimensione non compressa",
                        "es": "Tamaño descomprimido",
                        "nl": "Ongecomprimeerde grootte",
                        "ro": "Dimensiune necomprimată",
                        "lt": "Nesuspaustas dydis",
                    }
                ),
            },
        )

    # A generic, illustrative second table for layout demonstration purposes
    metadata_table = props.PropsUIPromptConsentFormTable(
        "example_metadata",
        2,
        props.Translatable(
            {
                "en": "Example Metadata Table",
                "de": "Beispieltabelle für Metadaten",
                "it": "Tabella di metadati di esempio",
                "es": "Tabla de metadatos de ejemplo",
                "nl": "Voorbeeld van metagegevens tabel",
                "ro": "Tabel de metadate de exemplu",
                "lt": "Metaduomenų lentelės pavyzdys",
            }
        ),
        props.Translatable(
            {
                "en": "This example table is included only to demonstrate that multiple tables can be shown. Its content is static and unrelated to your uploaded file.",
                "de": "Diese Beispieltabelle zeigt, dass mehrere Tabellen angezeigt werden können. Ihr Inhalt ist statisch und steht in keinem Zusammenhang mit Ihrer hochgeladenen Datei.",
                "it": "Questa tabella di esempio è inclusa solo per mostrare che è possibile visualizzare più tabelle. Il contenuto è statico e non è collegato al file caricato.",
                "es": "Esta tabla de ejemplo se incluye solo para mostrar que se pueden mostrar varias tablas. Su contenido es estático y no está relacionado con su archivo cargado.",
                "nl": "Deze voorbeeldtabel laat alleen zien dat er meerdere tabellen kunnen worden getoond. De inhoud is statisch en staat los van het geüploade bestand.",

            }
        ),
        pd.DataFrame(
            [
                ["participant-001", "Device A", "2025-06-01"],
                ["participant-002", "Device B", "2025-06-02"],
                ["participant-003", "Device C", "2025-06-03"],
            ],
            columns=["Participant ID", "Device", "Date"],
        ),
        headers={
                "Participant ID": props.Translatable(
                    {
                        "en": "Participant ID",
                        "de": "Teilnehmer-ID",
                        "it": "ID partecipante",
                        "es": "ID del participante",
                        "nl": "Deelnemer-ID",
                        "ro": "ID participant",
                        "lt": "Dalyvio ID",
                    }
                ),
                "Device": props.Translatable(
                    {
                        "en": "Device",
                        "de": "Gerät",
                        "it": "Dispositivo",
                        "es": "Dispositivo",
                        "nl": "Apparaat",
                        "ro": "Dispozitiv",
                        "lt": "Įrenginys",
                    }
                ),
                "Date": props.Translatable(
                    {
                        "en": "Date",
                        "de": "Datum",
                        "it": "Data",
                        "es": "Fecha",
                        "nl": "Datum",
                        "ro": "Data",
                        "lt": "Data",
                    }
                ),
            },
            data_frame_max_size=5000,  # default is 10000, limit or expand as required by expected data
        )

    # Construct and render the final consent page
    result = yield render_data_submission_page(
        [
            item
            for item in [
                description,
                data_table,
                metadata_table,
                props.PropsUIDataSubmissionButtons(
                    donate_question=props.Translatable(
                        {
                            "en": "Would you like to donate the above data?",
                            "de": "Möchten Sie die obenstehenden Daten spenden?",
                            "it": "Vuoi donare i dati sopra indicati?",
                            "es": "¿Le gustaría donar los datos anteriores?",
                            "nl": "Wilt u de bovenstaande gegevens doneren?",
                            "ro": "Doriți să donați datele de mai sus?",
                            "lt": "Ar norėtumėte paaukoti aukščiau pateiktus duomenis?",
                        }
                    ),
                    donate_button=props.Translatable(
                        {
                            "en": "Yes, donate",
                            "de": "Ja, spenden",
                            "it": "Sì, dona",
                            "es": "Sí, donar",
                            "nl": "Ja, doneer",
                            "ro": "Da, donez",
                            "lt": "Taip, paaukokite",
                        }
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
