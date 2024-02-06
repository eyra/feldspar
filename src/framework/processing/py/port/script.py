import fnmatch
import json
import numpy as np
from datetime import datetime
from collections import namedtuple
import os.path
import port.api.props as props
from port.api.commands import CommandSystemDonate, CommandSystemExit, CommandUIRender

import pandas as pd
import zipfile
import json

ExtractionResult = namedtuple("ExtractionResult", ["id", "title", "data_frame"])
filter_start_date = datetime(2017, 1, 1)


def get_in(dct, *key_path):
    for key in key_path:
        dct = dct.get(key)
        if dct is None:
            return
    return dct


def parse_json_to_dataframe(parsed_dict):
    data = []
    for obj in parsed_dict["timelineObjects"]:
        if "activitySegment" not in obj:
            continue

        segment = obj["activitySegment"]
        start_timestamp_str = segment["duration"]["startTimestamp"]
        start_timestamp = datetime.fromisoformat(
            start_timestamp_str[:-1]
        )  # remove the 'Z'

        if start_timestamp < filter_start_date:
            continue

        activity_type = segment["activityType"]

        if activity_type not in {"WALKING", "CYCLING", "RUNNING"}:
            continue

        if meters := get_in(segment, "waypointPath", "distanceMeters"):
            distance_meters = meters
        elif meters := get_in(segment, "simplifiedRawPath", "distanceMeters"):
            distance_meters = meters
        elif meters := segment.get("distance"):
            distance_meters = meters
        else:
            continue

        data.append([start_timestamp, activity_type, distance_meters])

    return pd.DataFrame(
        data, columns=["startTimestamp", "activityType", "distanceMeters"]
    )


def aggregate_distance_by_day_activity(df):
    # Format the startTimestamp to "year-month-day" format
    df["startTimestamp"] = df["startTimestamp"].dt.strftime("%Y-%m-%d")

    # Group by formatted date and activityType, then aggregate the distance
    aggregated_df = (
        df.groupby(["startTimestamp", "activityType"])["distanceMeters"]
        .sum()
        .reset_index()
    )

    return aggregated_df


def extract(df):
    if df.empty:
        return []
    aggregated_df = aggregate_distance_by_day_activity(df)
    aggregated_df["Afstand in m"] = aggregated_df["distanceMeters"].apply(np.ceil)

    results = []
    for activity_type, title in [
        ("WALKING", {"en": "Walking", "nl": "Gewandeld"}),
        ("CYCLING", {"en": "Cycling", "nl": "Gefietst"}),
        ("RUNNING", {"en": "Running", "nl": "Hardgelopen"}),
    ]:
        df = aggregated_df.loc[aggregated_df["activityType"] == activity_type]
        if len(df) == 0:
            continue

        df["Datum"] = df["startTimestamp"]
        df = (
            df.drop(columns=["distanceMeters", "activityType", "startTimestamp"])
            .reset_index(drop=True)
            .reindex(columns=["Datum", "Afstand in m"])
        )
        results.append(
            ExtractionResult(
                id=activity_type.lower(),
                title=props.Translatable(title),
                data_frame=df,
            )
        )
    return results


def process(sessionId):
    meta_data = []
    meta_data.append(("debug", f"start"))

    # STEP 1: select the file
    data = None
    while True:
        promptFile = prompt_file()
        fileResult = yield render_donation_page(promptFile)
        if fileResult.__type__ == "PayloadString":
            meta_data.append(("debug", f"extracting file"))
            extractionResult = extract_data_from_zip(fileResult.value)
            if extractionResult == "invalid":
                meta_data.append(
                    ("debug", f"prompt confirmation to retry file selection")
                )
                retry_result = yield render_donation_page(retry_confirmation())
                if retry_result.__type__ == "PayloadTrue":
                    meta_data.append(("debug", f"retry prompt file"))
                    continue
                else:
                    meta_data.append(("debug", f"skip due to invalid file"))
                    data = ("aborted", fileResult.value)
                    break
            if extractionResult == "no-data":
                retry_result = yield render_donation_page(retry_no_data_confirmation())
                if retry_result.__type__ == "PayloadTrue":
                    continue
                else:
                    data = ("aborted", fileResult.value)
                    break
            else:
                meta_data.append(
                    ("debug", f"extraction successful, go to consent form")
                )
                data = extractionResult
                break
        else:
            meta_data.append(("debug", f"skip to next step"))
            break

    # STEP 2: ask for consent
    meta_data.append(("debug", f"prompt consent"))
    error_detected = isinstance(data, tuple)
    if error_detected:
        prompt = prompt_report_consent(os.path.basename(data[1]), meta_data)
    else:
        prompt = prompt_consent(data, meta_data)
    consent_result = yield render_donation_page(prompt)
    if consent_result.__type__ == "PayloadJSON":
        meta_data.append(("debug", f"donate consent data"))
        donation_data = json.loads(consent_result.value)
    elif consent_result.__type__ == "PayloadFalse":
        donation_data = {"status": "donation declined"}
    if error_detected:
        donation_data["error"] = "Unable to extract data from package"
    yield donate(f"{sessionId}", json.dumps(donation_data))


def render_donation_page(body):
    header = props.PropsUIHeader(
        props.Translatable({"en": "Google location", "nl": "Google locatie"})
    )

    page = props.PropsUIPageDonation("google-location", header, body)
    return CommandUIRender(page)


def retry_confirmation():
    text = props.Translatable(
        {
            "en": f"Unfortunately, we cannot process your file. Continue, if you are sure that you selected the right file. Try again to select a different file.",
            "nl": f"Helaas, kunnen we uw bestand niet verwerken. Weet u zeker dat u het juiste bestand heeft gekozen? Ga dan verder. Probeer opnieuw als u een ander bestand wilt kiezen.",
        }
    )
    ok = props.Translatable({"en": "Try again", "nl": "Probeer opnieuw"})
    cancel = props.Translatable({"en": "Continue", "nl": "Verder"})
    return props.PropsUIPromptConfirm(text, ok, cancel)


def retry_no_data_confirmation():
    text = props.Translatable(
        {
            "en": f"Unfortunately we could not detect any location information in your file. Continue, if you are sure that you selected the right file. Try again to select a different file.",
            "nl": f"We hebben helaas geen locatie informatie in uw bestand gevonden. Weet u zeker dat u het juiste bestand heeft gekozen? Ga dan verder. Probeer opnieuw als u een ander bestand wilt kiezen.",
        }
    )
    ok = props.Translatable({"en": "Try again", "nl": "Probeer opnieuw"})
    cancel = props.Translatable({"en": "Continue", "nl": "Verder"})
    return props.PropsUIPromptConfirm(text, ok, cancel)


def prompt_file():
    description = props.Translatable(
        {
            "en": f"Click 'Choose file' to choose the file that you received from Google. If you click 'Continue', the data that is required for research is extracted from your file.",
            "nl": f"Klik op ‘Kies bestand’ om het bestand dat u ontvangen hebt van Google te kiezen. Als u op 'Verder' klikt worden de gegevens die nodig zijn voor het onderzoek uit uw bestand gehaald.",
        }
    )

    return props.PropsUIPromptFileInput(description, "application/zip")


def prompt_consent(data, meta_data):
    log_title = props.Translatable({"en": "Log messages", "nl": "Log berichten"})

    tables = []
    if data is not None:
        tables = [
            props.PropsUIPromptConsentFormTable(table.id, table.title, table.data_frame)
            for table in data
        ]

    meta_frame = pd.DataFrame(meta_data, columns=["type", "message"])
    meta_table = props.PropsUIPromptConsentFormTable(
        "log_messages", log_title, meta_frame
    )
    return props.PropsUIPromptConsentForm(tables, [meta_table])


def prompt_report_consent(filename, meta_data):
    log_title = props.Translatable({"en": "Log messages", "nl": "Log berichten"})

    tables = [
        props.PropsUIPromptConsentFormTable(
            "filename",
            props.Translatable({"nl": "Bestandsnaam", "en": "Filename"}),
            pd.DataFrame({"Bestandsnaam": [filename]}),
        )
    ]

    meta_frame = pd.DataFrame(meta_data, columns=["type", "message"])
    meta_table = props.PropsUIPromptConsentFormTable(
        "log_messages", log_title, meta_frame
    )
    return props.PropsUIPromptConsentForm(
        tables,
        [meta_table],
        description=props.Translatable(
            {
                "nl": "Helaas konden we geen gegevens uit uw gegevenspakket halen. Wilt u de onderzoekers van het LISS panel hiervan op de hoogte stellen?",
                "en": "Unfortunately we could not extract any data from your package. Would you like to report this to the researchers of the LISS panel?",
            }
        ),
        donate_question=props.Translatable(
            {
                "en": "Do you want to report the above data?",
                "nl": "Wilt u de bovenstaande gegevens rapporteren?",
            }
        ),
        donate_button=props.Translatable({"nl": "Ja, rapporteer", "en": "Yes, report"}),
    )


def filter_json_files(file_list):
    pattern = "**/Semantic Location History/*/*_*.json"
    return [f for f in file_list if fnmatch.fnmatch(f, pattern)]


def load_and_process_file(z, file, callback):
    with z.open(file) as f:
        return callback(json.load(f))


def extract_data_from_zip(zip_filepath):
    with zipfile.ZipFile(zip_filepath, "r") as z:
        files = filter_json_files(z.namelist())
        dfs = [load_and_process_file(z, f, parse_json_to_dataframe) for f in files]
    if not dfs:
        return "no-data"
    df = pd.concat(dfs, ignore_index=True)
    return extract(df)


def donate(key, json_string):
    return CommandSystemDonate(key, json_string)


def exit(code, info):
    return CommandSystemExit(code, info)


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        print(extract_data_from_zip(sys.argv[1]))
    else:
        print("please provide a zip file as argument")
