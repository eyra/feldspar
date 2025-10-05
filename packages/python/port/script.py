from port.api.assets import *
from port.api.commands import CommandSystemDonate, CommandSystemExit
from port.rendering import PageRenderer
from port.parsers import YoutubeHistoryParser
from port.parsers import ParseResult

import port.file_operations as file_operations
import json


def process(sessionId):
    key = "zip-youtube"
    page_renderer = PageRenderer()
    file_parser = YoutubeHistoryParser()

    # File selection & extraction loop
    while True:
        file_result = yield page_renderer.prompt_file_page(
            "application/zip, text/plain"
        )

        try:
            assert (
                getattr(file_result, "__type__", None) == "PayloadString"
            ), "Invalid payload type"

            zip_ref = file_operations.get_zipfile(file_result.value)
            assert zip_ref, "Failed to open zip file"
            files = file_operations.get_files(zip_ref)
            assert files, "No files found in the zip archive"

            extracted_files = []
            for i, filename in enumerate(files, start=1):
                yield page_renderer.prompt_extraction_message_page(
                    f"Extracting file: {filename}", (i * 100) / len(files)
                )
                extracted_files.append(file_operations.extract_file(zip_ref, filename))

            file_parser.parse_files(extracted_files)
            assert (
                file_parser.parse_result == ParseResult.JSON_PARSED
            ), file_parser.parse_result
            file_parser.process_histories()
            assert (
                file_parser.parse_result == ParseResult.JSON_PROCESSED
            ), file_parser.parse_result

            break  # Exit loop on success

        except AssertionError as e:
            yield page_renderer.retry_confirmation_page(str(e))

    # --- Consent & donation flow ---
    for page in page_renderer.prompt_consent_generator(
        file_parser.search_history,
        file_parser.search_watch_history,
        file_parser.watch_history,
    ):
        result = yield page
        rtype = getattr(result, "__type__", None)

        if rtype == "PayloadJSON":
            data = json.loads(result.value)
            yield donate(f"{sessionId}-{key}", json.dumps(data))

        elif rtype == "PayloadFalse":
            yield donate(
                f"{sessionId}-{key}", json.dumps({"status": "data_submission declined"})
            )


def donate(key, json_string):
    return CommandSystemDonate(key, json_string)


def exit(code, info):
    return CommandSystemExit(code, info)
