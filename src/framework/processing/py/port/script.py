import port.api.props as props
from port.api.commands import (CommandSystemDonate, CommandSystemExit, CommandUIRender)

import pandas as pd
import zipfile

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
        activity_type = segment["activityType"]

        if activity_type not in {"WALKING", "CYCLING", "RUNNING"}:
            continue

        start_timestamp_str = segment["duration"]["startTimestamp"]
        start_timestamp = datetime.fromisoformat(
            start_timestamp_str[:-1]
        )  # remove the 'Z'

        if start_timestamp < filter_start_date:
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

    platforms = ["Twitter", "Facebook", "Instagram", "Youtube"]

    subflows = len(platforms)
    steps = 2
    step_percentage = (100/subflows)/steps

    # progress in %
    progress = 0

    for index, platform in enumerate(platforms):
        meta_data = []
        meta_data.append(("debug", f"{platform}: start"))

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
            if extractionResult == "no-data":
                retry_result = yield render_donation_page(
                    retry_no_data_confirmation(), 33
                )
                if retry_result.__type__ == "PayloadTrue":
                    continue
                else:
                    meta_data.append(("debug", f"{platform}: prompt confirmation to retry file selection"))
                    retry_result = yield render_donation_page(platform, retry_confirmation(platform), progress)
                    if retry_result.__type__ == 'PayloadTrue':
                        meta_data.append(("debug", f"{platform}: skip due to invalid file"))
                        continue
                    else:
                        meta_data.append(("debug", f"{platform}: retry prompt file"))
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
        progress += step_percentage
        if data is not None:
            meta_data.append(("debug", f"{platform}: prompt consent"))
            prompt = prompt_consent(platform, data, meta_data)
            consent_result = yield render_donation_page(platform, prompt, progress)
            if consent_result.__type__ == "PayloadJSON":
                meta_data.append(("debug", f"{platform}: donate consent data"))
                yield donate(f"{sessionId}-{platform}", consent_result.value)

    yield exit(0, "Success")
    yield render_end_page()


def render_end_page():
    page = props.PropsUIPageEnd()
    return CommandUIRender(page)


def render_donation_page(body, progress):
    header = props.PropsUIHeader(
        props.Translatable({"en": "Google location", "nl": "Google locatie"})
    )

    footer = props.PropsUIFooter(progress)
    page = props.PropsUIPageDonation("google-location", header, body, footer)
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

    return props.PropsUIPromptFileInput(description, extensions)


def prompt_consent(tables, meta_data):
    log_title = props.Translatable({"en": "Log messages", "nl": "Log berichten"})
    tables = [
        props.PropsUIPromptConsentFormTable(table.id, table.title, table.data_frame)
        for table in tables
    ]
    meta_frame = pd.DataFrame(meta_data, columns=["type", "message"])
    meta_table = props.PropsUIPromptConsentFormTable("log_messages", log_title, meta_frame)
    return props.PropsUIPromptConsentForm([table], [meta_table])


def donate(key, json_string):
    return CommandSystemDonate(key, json_string)

def exit(code, info):
    return CommandSystemExit(code, info)