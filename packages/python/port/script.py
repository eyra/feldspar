from port.api.assets import *
from port.api.commands import CommandSystemDonate, CommandSystemExit
from port.rendering import PageRenderer
import port.file_operations as file_operations

import logging
import pandas as pd
import json

logger = logging.getLogger(__name__)

def process(sessionId):
    key = "zip-youtube"
    page_renderer = PageRenderer()

    # --- File selection & extraction loop ---
    while True:
        file_result = yield page_renderer.prompt_file_page("application/zip, text/plain")

        if getattr(file_result, "__type__", None) != "PayloadString":
            yield page_renderer.retry_confirmation_page()
            continue

        zip_ref = file_operations.get_zipfile(file_result.value)
        if not zip_ref:
            yield page_renderer.retry_confirmation_page()
            continue

        files = file_operations.get_files(zip_ref)
        if not files:
            yield page_renderer.retry_confirmation_page()
            continue

        extraction_result = []
        total = len(files)
        for i, filename in enumerate(files, start=1):
            yield page_renderer.prompt_extraction_message_page(
                f"Extracting file: {filename}", (i * 100) / total
            )
            extraction_result.append(file_operations.extract_file(zip_ref, filename))

        if extraction_result:
            break

        yield page_renderer.retry_confirmation_page()

    # --- Consent & donation flow ---
    for prompt in page_renderer.prompt_consent_generator(extraction_result):
        result = yield prompt
        rtype = getattr(result, "__type__", None)

        if rtype == "PayloadJSON":
            meta_frame = pd.DataFrame([], columns=["type", "message"])
            data = json.loads(result.value)
            data["meta"] = meta_frame.to_json()
            yield donate(f"{sessionId}-{key}", json.dumps(data))

        elif rtype == "PayloadFalse":
            yield donate(f"{sessionId}-{key}", json.dumps({"status": "data_submission declined"}))


def donate(key, json_string):
    return CommandSystemDonate(key, json_string)


def exit(code, info):
    return CommandSystemExit(code, info)
