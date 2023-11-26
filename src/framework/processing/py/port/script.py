import fnmatch
import json
from datetime import datetime
from collections import namedtuple

import port.api.props as props
from port.api.commands import CommandSystemDonate, CommandUIRender

import pandas as pd
import zipfile

ExtractionResult = namedtuple("ExtractionResult", ["id", "title", "data_frame"])


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
        activity_type = segment["activityType"]

        if activity_type not in {"WALKING", "CYCLING","RUNNING"}:
            continue

        start_timestamp_str = segment["duration"]["startTimestamp"]
        start_timestamp = datetime.fromisoformat(
            start_timestamp_str[:-1]
        )  # remove the 'Z'

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
    aggregated_df = aggregate_distance_by_day_activity(df)
    aggregated_df["Afstand in km"] = aggregated_df["distanceMeters"] / 1000

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
            .reindex(columns=["Datum", "Afstand in km"])
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
    yield donate(f"{sessionId}-tracking", '[{ "message": "user entered script" }]')

    meta_data = []
    meta_data.append(("debug", f"start"))

    # STEP 1: select the file
    data = None
    while True:
        print("A")
        promptFile = prompt_file()
        print("B")
        fileResult = yield render_donation_page(promptFile, 33)
        print("C")
        if fileResult.__type__ == "PayloadString":
            meta_data.append(("debug", f"extracting file"))
            extractionResult = extract_data_from_zip(fileResult.value)
            if extractionResult == "invalid":
                meta_data.append(
                    ("debug", f"prompt confirmation to retry file selection")
                )
                retry_result = yield render_donation_page(retry_confirmation(), 33)
                if retry_result.__type__ == "PayloadTrue":
                    meta_data.append(("debug", f"skip due to invalid file"))
                    continue
                else:
                    meta_data.append(("debug", f"retry prompt file"))
                    break
            if extractionResult == 'no-data':
                retry_result = yield render_donation_page(retry_no_data_confirmation(), 33)
                if retry_result.__type__ == "PayloadTrue":
                    continue
                else:
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
    if data is not None:
        meta_data.append(("debug", f"prompt consent"))
        prompt = prompt_consent(data, meta_data)
        consent_result = yield render_donation_page(prompt, 67)
        if consent_result.__type__ == "PayloadJSON":
            meta_data.append(("debug", f"donate consent data"))
            yield donate(f"{sessionId}", consent_result.value)

    yield exit(0, "Success")
    yield render_end_page()


def render_end_page():
    page = props.PropsUIPageEnd()
    return CommandUIRender(page)


def render_donation_page(body, progress):
    header = props.PropsUIHeader(props.Translatable({
        "en": "Google activity", 
        "nl": "Google activity"
    }))

    footer = props.PropsUIFooter(progress)
    page = props.PropsUIPageDonation("google-activity", header, body, footer)
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
            "en": f"There does not seem to be location information in your file. Continue, if you are sure that you selected the right file. Try again to select a different file.",
            "nl": f"Helaas, er lijkt geen lokatie informatie in uw bestand te zitten. Weet u zeker dat u het juiste bestand heeft gekozen? Ga dan verder. Probeer opnieuw als u een ander bestand wilt kiezen.",
        }
    )
    ok = props.Translatable({"en": "Try again", "nl": "Probeer opnieuw"})
    cancel = props.Translatable({"en": "Continue", "nl": "Verder"})
    return props.PropsUIPromptConfirm(text, ok, cancel)



def prompt_file():
    description = props.Translatable({
        "en": f"Please follow the download instructions and choose the file that you stored on your device. Click 'Skip' at the right bottom, if you do not have a file. ",
        "nl": f"Volg de download instructies en kies het bestand dat u opgeslagen heeft op uw apparaat. Als u geen bestand heeft klik dan op 'Overslaan' rechts onder.",
    })

    return props.PropsUIPromptFileInput(description, "application/zip")


def prompt_consent(tables, meta_data):
    log_title = props.Translatable({"en": "Log messages", "nl": "Log berichten"})

    tables = [
        props.PropsUIPromptConsentFormTable(table.id, table.title, table.data_frame)
        for table in tables
    ]
    meta_frame = pd.DataFrame(meta_data, columns=["type", "message"])
    meta_table = props.PropsUIPromptConsentFormTable(
        "log_messages", log_title, meta_frame
    )
    return props.PropsUIPromptConsentForm(tables, [meta_table])


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


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        print(extract_data_from_zip(sys.argv[1]))
    else:
        print("please provide a zip file as argument")
