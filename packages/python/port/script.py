# --------------------------------------------------------------------
# Note to developers:
#
# This script (`script.py`) provides a basic data donation flow using
# standard UI components available in Feldspar.
#
# It demonstrates:
#   - File upload and validation
#   - Multiple named extraction steps with yield FlushLogs between them
#     so log messages reach the client in real time during long extractions
#   - Multiple result tables shown in the consent form
#
# For a more advanced example that includes custom UI components
# (e.g. a custom React-based component integrated with Python),
# please refer to:
#
#     `script_custom_ui.py`
#
# That script demonstrates how to define and use your own components
# using Feldspar's React integration and how to render them via Python.
# --------------------------------------------------------------------

import port.api.props as props
from port.api.assets import *
from port.api.commands import CommandSystemDonate, CommandSystemExit, CommandUIRender, FlushLogs

import logging
import os
import pandas as pd
import zipfile
import json
import time
from collections import namedtuple

logger = logging.getLogger(__name__)

ExtractionResult = namedtuple("ExtractionResult", ["name", "data_frame"])


######################
# Data donation flow #
######################

def process(sessionId):
    logger.info("user entered script")
    key = "zip-contents-example"

    results = None

    while True:
        fileResult = yield from step_1_select_file(key)
        if fileResult is None:
            break

        results, retry = yield from step_2_extract_data_from_file(key, fileResult)
        if retry:
            continue
        break

    if results:
        yield from step_3_consent(key, sessionId, results)


def step_1_select_file(key):
    logger.debug(f"{key}: prompt file")
    fileResult = yield render_data_submission_page([prompt_file("application/zip, text/plain")])
    if fileResult.__type__ != "PayloadFile":
        logger.debug(f"{key}: no file selected, exit")
        return None
    return fileResult


def step_2_extract_data_from_file(key, fileResult):
    logger.debug(f"{key}: extracting file")
    results = None
    try:
        results = yield from extract_data(fileResult.value)
    except (IOError, zipfile.BadZipFile):
        logger.debug(f"{key}: prompt confirmation to retry file selection")
        retry_result = yield render_data_submission_page(retry_confirmation())
        if retry_result.__type__ == "PayloadTrue":
            return None, True
        logger.debug(f"{key}: user declined retry, exit")
        return None, False
    logger.debug(f"{key}: extraction successful, go to consent form")
    return results, False


def step_3_consent(key, sessionId, results):
    logger.debug(f"{key}: prompt consent")
    for prompt in prompt_consent(results):
        result = yield prompt
        if result.__type__ == "PayloadJSON":
            logger.debug(f"{key}: donate consent data")
            yield donate(f"{sessionId}-{key}", result.value)
        if result.__type__ == "PayloadFalse":
            value = json.dumps('{"status" : "data_submission declined"}')
            yield donate(f"{sessionId}-{key}", value)


##########################
# Zip file processing    #
##########################

def extract_data(path):
    """Generator that runs extraction steps, returning the results list.

    Yields FlushLogs between steps so progress logs reach the client in real
    time rather than all at once when the consent page renders. Call via:

        results = yield from extract_data(path)
    """
    logger.info("extract_data: opening zip file")
    zf = zipfile.ZipFile(path)
    logger.info(f"extract_data: zip opened, {len(zf.namelist())} files")
    results = []

    extractors = [
        ("file inventory", lambda: extract_file_inventory(zf)),
        ("file types",     lambda: extract_file_types(zf)),
        ("largest files",  lambda: extract_largest_files(zf)),
    ]

    for name, fn in extractors:
        logger.debug(f"extract_data: extracting {name}...")
        try:
            results.append(fn())
            logger.info(f"extract_data: {name} extracted successfully")
            yield FlushLogs  # stream progress logs to the client in real time between extractors
        except Exception as e:
            logger.error(f"extract_data: failed to extract {name}: {e}", exc_info=True)
            raise

    logger.info(f"extract_data: done, {len(results)} tables extracted")
    return results


def extract_file_inventory(zf):
    """List every file in the zip with its compressed and uncompressed size."""
    rows = []
    for info in zf.infolist():
        time.sleep(0.01)  # artificial delay — remove in production
        rows.append({
            "Filename": info.filename,
            "Compressed size": info.compress_size,
            "Size": info.file_size,
        })
    return ExtractionResult("file_inventory", pd.DataFrame(rows, columns=["Filename", "Compressed size", "Size"]))


def extract_file_types(zf):
    """Count files grouped by extension."""
    from collections import Counter
    extensions = Counter(
        os.path.splitext(name)[1].lower() or "(none)"
        for name in zf.namelist()
    )
    rows = [{"Extension": ext, "Count": count} for ext, count in sorted(extensions.items())]
    return ExtractionResult("file_types", pd.DataFrame(rows, columns=["Extension", "Count"]))


def extract_largest_files(zf, n=10):
    """Show the top N files by uncompressed size."""
    files = sorted(zf.infolist(), key=lambda i: i.file_size, reverse=True)[:n]
    rows = [{"Filename": i.filename, "Size": i.file_size} for i in files]
    return ExtractionResult("largest_files", pd.DataFrame(rows, columns=["Filename", "Size"]))


######################
# UI helpers         #
######################

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


def prompt_consent(data):
    """data is a list of ExtractionResult namedtuples from extract_data."""
    description = props.PropsUIPromptText(
        text=props.Translatable(
            {
                "en": "Please review the data below. You can remove any information you prefer not to share. Thank you for supporting this research project!",
                "de": "Bitte überprüfen Sie Ihre Daten unten. Sie können alle Daten entfernen, die Sie nicht teilen möchten. Vielen Dank für Ihre Unterstützung dieses Forschungsprojekts!",
                "it": "Controlla i tuoi dati qui sotto. Puoi rimuovere qualsiasi dato che preferisci non condividere. Grazie per il tuo supporto a questo progetto di ricerca!",
                "es": "Revise sus datos a continuación. Puede eliminar cualquier dato que prefiera no compartir. ¡Gracias por apoyar este proyecto de investigación!",
                "nl": "Bekijk hieronder uw gegevens. U kunt gegevens verwijderen die u liever niet deelt. Bedankt voor uw steun aan dit onderzoeksproject!",
                "ro": "Vă rugăm să revizuiți datele de mai jos. Puteți elimina orice date pe care preferați să nu le partajați. Vă mulțumim că sprijiniți acest proiect de cercetare!",
                "lt": "Prašome peržiūrėti savo duomenis žemiau. Galite pašalinti bet kokius duomenis, kurių nenorite bendrinti. Ačiū, kad remiate šį tyrimų projektą!",
            }
        )
    )

    # Tables derived from the uploaded zip file
    tables = [
        props.PropsUIPromptConsentFormTable(
            result.name,
            i,
            props.Translatable({"en": result.name.replace("_", " ").title(), "nl": result.name.replace("_", " ").title()}),
            props.Translatable({"en": f"Overview of {result.name.replace('_', ' ')} from your zip file."}),
            result.data_frame,
        )
        for i, result in enumerate(data, start=1)
    ]

    # Example of a static table with hardcoded data — useful for reference data
    # or metadata that does not come from the uploaded file.
    static_table = props.PropsUIPromptConsentFormTable(
        "zip_content",
        len(data) + 1,
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
                "en": "This table is static — its content is hardcoded, not derived from the uploaded file. Use this pattern for reference data or study metadata.",
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
        data_frame_max_size=5000,
    )

    result = yield render_data_submission_page(
        [description]
        + tables
        + [static_table]
        + [
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
    )
    return result


def donate(key, json_string):
    return CommandSystemDonate(key, json_string)


def exit(code, info):
    return CommandSystemExit(code, info)


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python -m port.script path/to/file.zip")
        sys.exit(1)
    gen = extract_data(sys.argv[1])
    try:
        while True:
            next(gen)
    except StopIteration as e:
        print(e.value)
