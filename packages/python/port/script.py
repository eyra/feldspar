import pandas as pd
import port.file_operations as file_operations
import json
import logging

from port.api.assets import *
from port.api.commands import CommandSystemDonate, CommandSystemExit
from port.rendering import PageRenderer
from port.parsers import YoutubeHistoryParser
from port.parsers import ParseResult


logger = logging.getLogger(__name__)

def process(session_id):
    key = "zip-youtube"
    page_renderer = PageRenderer()
    file_parser = YoutubeHistoryParser()
    logger.debug(f"{key}: start")

    # File selection & extraction loop
    while True:
        logger.debug(f"{key}: prompting for file")
        file_result = yield page_renderer.prompt_file_page(
            "application/zip, text/plain"
        )

        logger.debug(f"{key}: extracting file")
        try:
            assert (
                getattr(file_result, "__type__", None) == "PayloadFile"
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

            break  # exit file submission loop on success file extraction

        except AssertionError as e:
            logger.error("{}: extraction failed, retrying ({})".format(key, str(e)))
            yield page_renderer.retry_confirmation_page(str(e))

    # --- Consent & donation flow ---
    logger.debug(f"{key}: extraction successful, go to consent form")
    for page in page_renderer.prompt_consent_generator(
        file_parser.search_history,
        file_parser.search_watch_history,
        file_parser.watch_history,
    ):
        result = yield page
        rtype = getattr(result, "__type__", None)

        if rtype == "PayloadJSON":
            logger.debug(f"{key}: donate consent data")
            data = json.loads(result.value)
            yield donate(session_id, key, json.dumps(data))

        elif rtype == "PayloadFalse":
            yield donate(
                session_id, key, json.dumps({"status": "data_submission declined"})
            )

        yield exit(1, "received unexpected consent form result")


def donate(session_id, key, data):
    donation_key = f"{session_id}-{key}"
    return CommandSystemDonate(donation_key, json.dumps(data))


def exit(code, info):
    return CommandSystemExit(code, info)
