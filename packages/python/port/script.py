import itertools
import port.api.props as props
from port.api.commands import CommandSystemDonate, CommandUIRender

import pandas as pd
import zipfile
import json
import datetime
import pytz
import fnmatch
from collections import defaultdict, namedtuple
from contextlib import suppress

##########################
# Instagram file processing #
##########################

filter_start = datetime.datetime.now() - datetime.timedelta(weeks=4 * 6)

datetime_format = "%Y-%m-%d %H:%M:%S"

i18n_table = {
    "followers": {
        "en": "Followers",
        "de": "Follower",
        "it": "Follower",
        "nl": "Volgers"
    },
    "following": {
        "en": "Following",
        "de": "Gefolgt",
        "it": "Seguiti",
        "nl": "Volgend"
    },
    "posts_published": {
        "en": "Posts published",
        "de": "Veröffentlichte Beiträge",
        "it": "Post pubblicati",
        "nl": "Gepubliceerde berichten"
    },
    "stories_published": {
        "en": "Stories published",
        "de": "Veröffentlichte Stories",
        "it": "Storie pubblicate",
        "nl": "Gepubliceerde verhalen"
    },
    "comments_published": {
        "en": "Comments published",
        "de": "Veröffentlichte Kommentare",
        "it": "Commenti pubblicati",
        "nl": "Gepubliceerde reacties"
    },
    "messages_sent": {
        "en": "Messages sent",
        "de": "Gesendete Nachrichten",
        "it": "Messaggi inviati",
        "nl": "Verzonden berichten"
    },
    "messages_received": {
        "en": "Messages received",
        "de": "Empfangene Nachrichten",
        "it": "Messaggi ricevuti",
        "nl": "Ontvangen berichten"
    },
    "ads_viewed": {
        "en": "Ads viewed",
        "de": "Anzeigen angesehen",
        "it": "Annunci visualizzati",
        "nl": "Advertenties bekeken"
    }
}


def get_translated_text(key, locale="en"):
    """
    Helper function to get translated text from i18n_table.
    Falls back to English if the requested locale is not available.

    Args:
        key (str): The translation key (e.g., 'followers', 'posts_published')
        locale (str): The locale code (e.g., 'en', 'de', 'it', 'nl')

    Returns:
        str: The translated text
    """
    entry = i18n_table[key]
    try:
        return entry[locale]
    except KeyError:
        return entry["en"]


def parse_datetime(value):
    utc_datetime = datetime.datetime.fromtimestamp(value, tz=datetime.timezone.utc)
    uk_timezone = pytz.timezone("Europe/London")
    return uk_timezone.normalize(utc_datetime.astimezone(uk_timezone))


def get_in(data_dict, *key_path):
    for k in key_path:
        data_dict = data_dict.get(k, None)
        if data_dict is None:
            return None
    return data_dict


def get_list(data_dict, *key_path):
    result = get_in(data_dict, *key_path)
    if result is None:
        return []
    return result


def get_dict(data_dict, *key_path):
    result = get_in(data_dict, *key_path)
    if result is None:
        return {}
    return result


def get_string(data_dict, *key_path):
    result = get_in(data_dict, *key_path)
    if result is None:
        return ""
    return result


def cast_number(data_dict, *key_path):
    value = get_in(data_dict, *key_path)
    if value is None or value == "None":
        return 0
    return value


def get_activity_video_browsing_list_data(data):
    return get_list(data, "Activity", "Video Browsing History", "VideoList")


def get_comment_list_data(data):
    return get_in(data, "Comment", "Comments", "CommentsList")


def filter_timestamps(timestamps):
    for timestamp in timestamps:
        if timestamp < filter_start or timestamp:
            continue
        yield timestamp


def get_count_by_date_key(timestamps, key_func):
    """Returns a dict of the form (key, count)

    The key is determined by the key_func, which takes a datetime object and
    returns an object suitable for sorting and usage as a dictionary key.

    The returned list is sorted by key.
    """
    item_count = defaultdict(int)
    for timestamp in timestamps:
        item_count[key_func(timestamp)] += 1
    return sorted(item_count.items())


def get_all_first(items):
    return (i[0] for i in items)


def hourly_key(date):
    return date.replace(minute=0, second=0, microsecond=0)


def daily_key(date):
    return date.date()


# =====================
def glob(zipfile, pattern):
    return fnmatch.filter(zipfile.namelist(), pattern)


def glob_json(zipfile, pattern):
    for name in glob(zipfile, pattern):
        with zipfile.open(name) as f:
            try:
                yield json.load(f)
            except json.JSONDecodeError:
                print(f"Error decoding JSON from {name}")
                raise

# =====================


def filtered_count(data, *key_path):
    items = get_list(data, *key_path)
    filtered_items = get_date_filtered_items(items)
    return len(list(filtered_items))


def get_chat_history(data):
    return get_dict(data, "Direct Messages", "Chat History", "ChatHistory")


def flatten_chat_history(history):
    return itertools.chain(*history.values())


def filter_by_key(items, key, value):
    return filter(lambda item: item[key] == value, items)


def exclude_by_key(items, key, value):
    """
    Return a filtered list where items that match key & value are excluded.
    """
    return filter(lambda item: item[key] != value, items)


def map_to_timeslot(series):
    return series.map(lambda hour: f"{hour}-{hour+1}")


def count_items(zipfile, pattern, key=None):
    count = 0
    for data in glob_json(zipfile, pattern):
        # Some files have dictionary, others a list of dictionaries. Normalize
        # this to always a list so the rest of the code works regardless.
        if isinstance(data, dict):
            data = [data]
        for item in data:
            if key is None:
                count += len(item)
            else:
                count += len(item[key])
    return count


def count_posts(zipfile):
    return len(list(get_video_posts_timestamps(zipfile)))

def count_stories(zipfile):
    return len(list(stories_timestamps(zipfile)))

def count_messages(zipfile):
    counts = {"sent": 0, "received": 0}
    for data in glob_json(zipfile, "*/messages/inbox/**/message_*.json"):
        donating_user = get_donating_user(data)
        for message in data["messages"]:
            key = "sent" if message["sender_name"] == donating_user else "received"
            counts[key] += 1
    return counts


def get_donating_user(data):
    participants = data["participants"]
    return participants[len(participants) - 1]["name"]


def extract_summary_data(zipfile, locale="en"):
    message_counts = count_messages(zipfile)
    summary_data = {
        "Description": [
            get_translated_text("followers", locale),
            get_translated_text("following", locale),
            get_translated_text("posts_published", locale),
            get_translated_text("stories_published", locale),
            get_translated_text("comments_published", locale),
            get_translated_text("messages_sent", locale),
            get_translated_text("messages_received", locale),
            get_translated_text("ads_viewed", locale),
        ],
        "Number": [
            count_items(
                zipfile,
                "*/followers_and_following/followers_*.json",
                "string_list_data",
            ),
            count_items(
                zipfile,
                "*/followers_and_following/following.json",
                "relationships_following",
            ),
            count_posts(zipfile),
            count_stories(zipfile),
            count_items(zipfile, "*/comments/post_comments_*.json"),
            message_counts["sent"],
            message_counts["received"],
            count_items(
                zipfile,
                "*/ads_and_topics/ads_viewed.json",
                "impressions_history_ads_seen",
            ),
        ],
    }

    description = props.Translatable(
        {
            "en": "This table contains summary information from your downloaded data. This might not match exactly with the numbers shown in your Instagram account.",
            "de": "Diese Tabelle enthält zusammengefasste Informationen aus Ihren heruntergeladenen Daten. Diese stimmen möglicherweise nicht genau mit den Zahlen in Ihrem Instagram-Konto überein.",
            "it": "Questa tabella contiene informazioni riassuntive dai tuoi dati scaricati. Questi potrebbero non corrispondere esattamente ai numeri mostrati nel tuo account Instagram.",
            "nl": "Deze tabel bevat samenvattende informatie van je gedownloade gegevens. Dit komt mogelijk niet exact overeen met de cijfers in je Instagram-account.",
        }
    )

    visualizations = []

    return ExtractionResult(
        "instagram_summary",
        props.Translatable(
            {
                "en": "Summary information",
                "de": "Zusammenfassende Informationen",
                "it": "Informazioni riassuntive",
                "nl": "Samenvatting gegevens",
            }
        ),
        pd.DataFrame(summary_data),
        description,
        visualizations,
        headers={
            "Description": props.Translatable(
                {
                    "en": "Description",
                    "de": "Beschreibung",
                    "it": "Descrizione",
                    "nl": "Beschrijving",
                }
            ),
            "Number": props.Translatable(
                {
                    "en": "Number",
                    "de": "Anzahl",
                    "it": "Totale",
                    "nl": "Totaal",
                }
            ),
        },
    )


def extract_direct_message_activity(zipfile):
    counter = itertools.count()
    person_ids = defaultdict(lambda: next(counter))
    sender_ids = []
    timestamps = []
    for data in glob_json(zipfile, "*/messages/inbox/**/message_*.json"):
        # Ensure the donating user is the first to get an ID
        donating_user = get_donating_user(data)
        person_ids[donating_user]
        for message in data["messages"]:
            sender_ids.append(person_ids[message["sender_name"]])
            timestamps.append(parse_datetime(message["timestamp_ms"] / 1000))
    df = pd.DataFrame({"Anonymous ID": sender_ids, "Sent": timestamps})
    df["Sent"] = pd.to_datetime(df["Sent"]).dt.strftime("%Y-%m-%d %H:%M")
    # Sort by sent time (newest first)
    df = df.sort_values(by=["Sent"], ascending=False).reset_index(drop=True)

    description = props.Translatable(
        {
            "en": "This table shows the times of the messages sent or received by you. The message content is not included and names have been anonymized.",
            "de": "Diese Tabelle zeigt die Uhrzeiten der von Ihnen gesendeten oder empfangenen Nachrichten. Der Nachrichteninhalt ist nicht enthalten und die Namen wurden anonymisiert.",
            "it": "Questa tabella mostra gli orari dei messaggi inviati o ricevuti da te. Il contenuto dei messaggi non è incluso e i nomi sono stati anonimizzati.",
            "nl": "Deze tabel toont de tijdstippen van berichten die je hebt verzonden of ontvangen. De inhoud van de berichten is niet inbegrepen en namen zijn geanonimiseerd.",
        }
    )

    visualizations = [
        dict(
            title={
                "en": "Direct message activity over time.",
                "nl": "Direct message activiteit in de loop van de tijd.",
            },
            type="area",
            group=dict(column="Sent", dateFormat="auto"),
            values=[
                dict(
                    label="Messages",
                    column="Anonymous ID",
                    aggregate="count",
                    addZeroes=True,
                )
            ],
        ),
        dict(
            title={
                "en": "Direct message activity per hour of the day.",
                "nl": "Direct message activiteit per uur van de dag",
            },
            type="bar",
            group=dict(column="Sent", dateFormat="hour_cycle"),
            values=[
                dict(
                    label="Messages",
                    column="Anonymous ID",
                    aggregate="count",
                    addZeroes=True,
                )
            ],
        ),
    ]

    return ExtractionResult(
        "instagram_direct_message_activity",
        props.Translatable(
            {
                "en": "Direct message activity",
                "de": "Aktivität bei Direktnachrichten",
                "it": "Attività dei messaggi diretti",
                "nl": "Bericht activiteit",
            }
        ),
        df,
        description,
        visualizations,
        headers={
            "Anonymous ID": props.Translatable(
                {
                    "en": "Anonymous ID",
                    "de": "Anonyme ID",
                    "it": "ID anonimo",
                    "nl": "Anonieme ID",
                }
            ),
            "Sent": props.Translatable(
                {
                    "en": "Sent",
                    "de": "Gesendet",
                    "it": "Inviato",
                    "nl": "Verzonden",
                }
            ),
        },
    )


def flatten_media(media):
    if isinstance(media, list):
        for item in media:
            yield from item["media"]
    else:
        yield media


def get_creation_timestamps(items):
    for item in items:
        yield parse_datetime(item["creation_timestamp"])


def get_media_creation_timestamps(items):
    return get_creation_timestamps(flatten_media(items))


def get_content_posts_timestamps(zipfile):
    # Old format
    for data in glob_json(zipfile, "*/content/posts_*.json"):

        yield from get_media_creation_timestamps(data)
    # New format
    for data in glob_json(zipfile, "your_instagram_activity/media/posts_*.json"):
        for post in data:
            for media in post["media"]:
                yield parse_datetime(media["creation_timestamp"])
                break


def get_media_timestamps(zipfile, pattern, key):
    for data in glob_json(zipfile, pattern):
        yield from get_media_creation_timestamps(data[key])


def df_from_timestamps(timestamps, column):
    df = pd.DataFrame({"timestamps": timestamps})
    counts = df.groupby(lambda x: hourly_key(df["timestamps"][x])).size()

    df = counts.reset_index()
    df.columns = ["timestamp", column]
    return df


def stories_timestamps(zipfile):
    # Old format
    for data in glob_json(zipfile, "*/content/stories.json"):
        for item in data["ig_stories"]:
            yield parse_datetime(item["creation_timestamp"])

    # New format
    for data in glob_json(zipfile, "your_instagram_activity/media/stories.json"):
        for item in data["ig_stories"]:
            yield parse_datetime(item["creation_timestamp"])
            

def df_from_timestamp_columns(a, b):
    data_frames = [
        df_from_timestamps(timestamps, column) for timestamps, column in [a, b]
    ]

    df = pd.merge(
        data_frames[0],
        data_frames[1],
        left_on="timestamp",
        right_on="timestamp",
        how="outer",
    ).sort_index()
    df["Date"] = pd.to_datetime(df["timestamp"]).dt.strftime("%Y-%m-%d %H:00:00")
    df["Timeslot"] = map_to_timeslot(pd.to_datetime(df["timestamp"]).dt.hour)
    df = df.reset_index(drop=True)
    df = (
        df.reindex(columns=["Date", "Timeslot", a[1], b[1]])
        .reset_index(drop=True)
        .fillna(0)
    )
    df[a[1]] = df[a[1]].astype(int)
    df[b[1]] = df[b[1]].astype(int)
    # Sort by date and timeslot (newest first)
    df = df.sort_values(by=["Date", "Timeslot"], ascending=False).reset_index(drop=True)
    return df


def get_video_posts_timestamps(zipfile):
    return itertools.chain(
        get_content_posts_timestamps(zipfile),
        get_media_timestamps(zipfile, "*/content/igtv_videos.json", "ig_igtv_media"),
        get_media_timestamps(zipfile, "*/content/reels.json", "ig_reels_media"),
    )


def extract_video_posts(zipfile):
    video_timestamps = get_video_posts_timestamps(zipfile)
    df = df_from_timestamp_columns(
        (video_timestamps, "Videos"), (stories_timestamps(zipfile), "Stories")
    )

    description = props.Translatable(
        {
            "en": "This table shows how many times you have posted content in either your feed or your story. For anonymization purposes, the exact time of the post is not shown, but grouped by the hour.",
            "de": "Diese Tabelle zeigt, wie oft Sie Inhalte entweder in Ihrem Feed oder in Ihrer Story gepostet haben. Zur Anonymisierung wird die genaue Uhrzeit des Beitrags nicht angezeigt, sondern nach Stunde gruppiert.",
            "it": "Questa tabella mostra quante volte hai pubblicato contenuti nel tuo feed o nella tua storia. Per motivi di anonimizzazione, l'orario esatto della pubblicazione non è mostrato, ma raggruppato per ora.",
            "nl": "Deze tabel toont hoe vaak je content hebt gepost in je feed of verhaal. Voor anonimiseringsdoeleinden wordt de exacte tijd van de post niet weergegeven, maar gegroepeerd per uur.",
        }
    )

    visualizations = [
        dict(
            title={
                "en": "Videos and stories over time.",
                "nl": "Video's en stories in de loop van de tijd",
            },
            type="line",
            group=dict(column="Date", dateFormat="auto"),
            values=[
                dict(
                    label="Videos",
                    column="Videos",
                    aggregate="sum",
                    addZeroes=True,
                ),
                dict(
                    label="Stories",
                    column="Stories",
                    aggregate="sum",
                    addZeroes=True,
                ),
            ],
        ),
        dict(
            title={
                "en": "Videos and stories per hour of the day.",
                "nl": "Video's en stories per uur van de dag",
            },
            type="bar",
            group=dict(column="Date", label="Hour", dateFormat="hour_cycle"),
            values=[
                dict(
                    label="Videos",
                    column="Videos",
                    aggregate="sum",
                    addZeroes=True,
                ),
                dict(
                    label="Stories",
                    column="Stories",
                    aggregate="sum",
                    addZeroes=True,
                ),
            ],
        ),
    ]
    return ExtractionResult(
        "instagram_video_posts",
        props.Translatable(
            {
                "en": "Posts",
                "de": "Beiträge",
                "it": "Pubblicati",
                "nl": "Berichten",
            }
        ),
        df,
        description,
        visualizations,
        headers={
            "Date": props.Translatable(
                {
                    "en": "Date",
                    "de": "Datum",
                    "it": "Data",
                    "nl": "Datum",
                }
            ),
            "Timeslot": props.Translatable(
                {
                    "en": "Timeslot",
                    "de": "Zeitraum",
                    "it": "Fascia oraria",
                    "nl": "Tijdslot",
                }
            ),
            "Videos": props.Translatable(
                {
                    "en": "Posts",
                    "de": "Posts",
                    "it": "Post",
                    "nl": "Posts",
                }
            ),
            "Stories": props.Translatable(
                {
                    "en": "Stories",
                    "de": "Stories",
                    "it": "Storie",
                    "nl": "Verhalen",
                }
            ),
        },
    )


def get_post_comments_timestamps(zipfile):
    return get_string_map_timestamps(zipfile, "*/comments/post_comments_*.json")


def get_string_map_timestamps(zipfile, pattern, key=None):
    for data in glob_json(zipfile, pattern):
        if key is not None:
            data = data[key]
        if isinstance(data, list):
            for item in data:
                yield parse_datetime(item["string_map_data"]["Time"]["timestamp"])
        else:
            yield parse_datetime(data["string_map_data"]["Time"]["timestamp"])



def get_string_list_timestamps(zipfile, pattern, key=None):
    for data in glob_json(zipfile, pattern):
        if key is not None:
            data = data[key]
        for item in data:
            yield parse_datetime(item["string_list_data"][0]["timestamp"])


def get_likes_timestamps(zipfile):
    return itertools.chain(
        get_string_list_timestamps(
            zipfile, "*/likes/liked_comments.json", "likes_comment_likes"
        ),
        get_string_list_timestamps(
            zipfile, "*/likes/liked_posts.json", "likes_media_likes"
        ),
    )


def extract_comments_and_likes(zipfile):
    comment_timestamps = get_post_comments_timestamps(zipfile)
    likes_timestamps = get_likes_timestamps(zipfile)
    df = df_from_timestamp_columns(
        (comment_timestamps, "Comments"), (likes_timestamps, "Likes")
    )

    description = props.Translatable(
        {
            "en": "This table shows how many times you have liked or placed comments on Instagram.",
            "de": "Diese Tabelle zeigt, wie oft Sie Beiträge auf Instagram geliked oder kommentiert haben.",
            "it": "Questa tabella mostra quante volte hai messo Mi piace o commentato su Instagram.",
            "nl": "Deze tabel laat zien hoe vaak je berichten op Instagram hebt geliked of becommentarieerd.",
        }
    )

    visualizations = [
        dict(
            title={
                "en": "Comments and likes per month.",
                "nl": "Comments en likes per maand",
            },
            type="line",
            group=dict(column="Date", label="Month", dateFormat="month"),
            values=[
                dict(
                    label="Comments",
                    column="Comments",
                    aggregate="sum",
                    addZeroes=True,
                ),
                dict(
                    label="Likes",
                    column="Likes",
                    aggregate="sum",
                    addZeroes=True,
                ),
            ],
        ),
        dict(
            title={
                "en": "Comments and likes per hour of the day.",
                "nl": "Comments en likes per uur van de dag",
            },
            type="bar",
            group=dict(column="Date", label="Hour", dateFormat="hour_cycle"),
            values=[
                dict(
                    label="Comments",
                    column="Comments",
                    aggregate="sum",
                    addZeroes=True,
                ),
                dict(
                    label="Likes",
                    column="Likes",
                    aggregate="sum",
                    addZeroes=True,
                ),
            ],
        ),
    ]

    return ExtractionResult(
        "instagram_comments_and_likes",
        props.Translatable(
            {
                "en": "Comments and likes",
                "de": "Kommentare und Likes",
                "it": "Commenti e Mi piace",
                "nl": "Reacties en likes",
            }
        ),
        df,
        description,
        visualizations,
        headers={
            "Date": props.Translatable(
                {
                    "en": "Date",
                    "de": "Datum",
                    "it": "Data",
                    "nl": "Datum",
                }
            ),
            "Timeslot": props.Translatable(
                {
                    "en": "Timeslot",
                    "de": "Zeitraum",
                    "it": "Fascia oraria",
                    "nl": "Tijdslot",
                }
            ),
            "Comments": props.Translatable(
                {
                    "en": "Comments",
                    "de": "Kommentare",
                    "it": "Commenti",
                    "nl": "Reacties",
                }
            ),
            "Likes": props.Translatable(
                {
                    "en": "Likes",
                    "de": "Likes",
                    "it": "Mi piace",
                    "nl": "Likes",
                }
            ),
        },
    )


def extract_viewed(zipfile):
    df = df_from_timestamp_columns(
        (
            get_string_map_timestamps(
                zipfile,
                "*/ads_and_topics/videos_watched.json",
                "impressions_history_videos_watched",
            ),
            "Videos",
        ),
        (
            get_string_map_timestamps(
                zipfile,
                "*/ads_and_topics/posts_viewed.json",
                "impressions_history_posts_seen",
            ),
            "Posts",
        ),
    )

    description = props.Translatable(
        {
            "en": "This table shows the number of videos and posts that you viewed over time.",
            "de": "Diese Tabelle zeigt die Anzahl der Videos und Beiträge, die Sie im Laufe der Zeit angesehen haben.",
            "it": "Questa tabella mostra il numero di video e post che hai visualizzato nel tempo.",
            "nl": "Deze tabel toont het aantal video's en berichten dat je in de loop van de tijd hebt bekeken.",
        }
    )

    visualizations = [
        dict(
            title={
                "en": "Number of videos and posts viewed over time.",
                "nl": "Aantal video's en posts bekeken in de loop van de tijd",
            },
            type="line",
            group=dict(column="Date", label="Date", dateFormat="auto"),
            values=[
                dict(
                    label="Videos",
                    column="Videos",
                    aggregate="sum",
                    addZeroes=True,
                ),
                dict(
                    label="Posts",
                    column="Posts",
                    aggregate="sum",
                    addZeroes=True,
                ),
            ],
        ),
        dict(
            title={
                "en": "Videos and posts viewed per hour of the day.",
                "nl": "Video's en posts bekeken per uur van de dag",
            },
            type="bar",
            group=dict(column="Date", label="Hour", dateFormat="hour_cycle"),
            values=[
                dict(
                    label="Videos",
                    column="Videos",
                    aggregate="sum",
                    addZeroes=True,
                ),
                dict(
                    label="Posts",
                    column="Posts",
                    aggregate="sum",
                    addZeroes=True,
                ),
            ],
        ),
    ]

    return ExtractionResult(
        "instagram_viewed",
        props.Translatable(
            {
                "en": "Viewed",
                "de": "Angesehen",
                "it": "Visualizzati",
                "nl": "Bekeken",
            }
        ),
        df,
        description,
        visualizations,
        headers={
            "Date": props.Translatable(
                {
                    "en": "Date",
                    "de": "Datum",
                    "it": "Data",
                    "nl": "Datum",
                }
            ),
            "Timeslot": props.Translatable(
                {
                    "en": "Timeslot",
                    "de": "Zeitraum",
                    "it": "Fascia oraria",
                    "nl": "Tijdslot",
                }
            ),
            "Videos": props.Translatable(
                {
                    "en": "Videos",
                    "de": "Videos",
                    "it": "Video",
                    "nl": "Video's",
                }
            ),
            "Posts": props.Translatable(
                {
                    "en": "Posts",
                    "de": "Beiträge",
                    "it": "Post",
                    "nl": "Berichten",
                }
            ),
        },
    )

def extract_data(path, locale="en"):
    zfile = zipfile.ZipFile(path)

    return [
        extract_summary_data(zfile, locale),
        extract_video_posts(zfile),
        extract_comments_and_likes(zfile),
        extract_viewed(zfile),
        extract_direct_message_activity(zfile),
    ]


######################
# Data donation flow #
######################


ExtractionResult = namedtuple(
    "ExtractionResult",
    ["id", "title", "data_frame", "description", "visualizations", "headers"],
)


class SkipToNextStep(Exception):
    pass


class DataDonationProcessor:
    def __init__(self, platform, mime_types, extractor, session_id, locale="en"):
        self.platform = platform
        self.mime_types = mime_types
        self.extractor = extractor
        self.session_id = session_id
        self.locale = locale
        self.progress = 0
        self.meta_data = []

    def process(self):
        with suppress(SkipToNextStep):
            while True:
                file_result = yield from self.prompt_file()

                self.log(f"extracting file")
                try:
                    extraction_result = self.extract_data(file_result.value)
                except (IOError, zipfile.BadZipFile):
                    self.log(f"prompt confirmation to retry file selection")
                    try_again = yield from self.prompt_retry()
                    if try_again:
                        continue
                    return
                else:
                    if extraction_result is None:
                        try_again = yield from self.prompt_retry()
                        if try_again:
                            continue
                        else:
                            return
                    self.log(f"extraction successful, go to consent form")
                    yield from self.prompt_consent(extraction_result)
                    return

    def prompt_retry(self):
        retry_result = yield render_donation_page(
            self.platform, [retry_confirmation(self.platform)]
        )
        return retry_result.__type__ == "PayloadTrue"

    def prompt_file(self):
        description = props.Translatable(
            {
                "en": f"Pick the file that you received from Instagram. In the next step, the data that is required for research is extracted from your file. This may take a while, thank you for your patience.",
                "de": f"Wählen Sie die Datei aus, die Sie von Instagram erhalten haben. Im nächsten Schritt werden die für die Forschung benötigten Daten aus Ihrer Datei extrahiert. Dies kann einige Zeit in Anspruch nehmen – vielen Dank für Ihre Geduld.",
                "it": f"Seleziona il file che hai ricevuto da Instagram. Nel passaggio successivo, i dati richiesti per la ricerca verranno estratti dal tuo file. Questo potrebbe richiedere un po’ di tempo, grazie per la pazienza.",
                "nl": f"Klik op ‘Kies bestand’ om het bestand dat u ontvangen hebt van Instagram te kiezen. Als u op 'Verder' klikt worden de gegevens die nodig zijn voor het onderzoek uit uw bestand gehaald. Dit kan soms even duren. Een moment geduld a.u.b.",
            }
        )
        prompt_file = props.PropsUIPromptFileInput(description, self.mime_types)
        file_result = yield render_donation_page(self.platform, [prompt_file])
        if file_result.__type__ != "PayloadString":
            self.log(f"skip to next step")
            raise SkipToNextStep()
        return file_result

    def log(self, message):
        self.meta_data.append(("debug", f"{self.platform}: {message}"))

    def extract_data(self, file):
        return self.extractor(file, self.locale)

    def prompt_consent(self, data):
        log_title = props.Translatable(
            {
                "en": "Log messages",
                "de": "Protokollnachrichten",
                "it": "Messaggi di log",
                "nl": "Logberichten",
            }
        )

        description = props.PropsUIPromptText(
            text=props.Translatable(
                {
                    "en": "Please review the data below. You can delete any information you prefer not to share. Your donation supports the research project introduced earlier. Thank you!",
                    "de": "Bitte überprüfen Sie die Daten unten. Sie können alle Informationen löschen, die Sie nicht teilen möchten. Ihre Spende unterstützt das zuvor vorgestellte Forschungsprojekt. Vielen Dank!",
                    "it": "Controlla i dati qui sotto. Puoi eliminare le informazioni che preferisci non condividere. La tua donazione sostiene il progetto di ricerca presentato in precedenza. Grazie!",
                    "nl": "Controleer de gegevens hieronder. Je kunt alle informatie verwijderen die je liever niet deelt. Je donatie ondersteunt het eerder geïntroduceerde onderzoeksproject. Dank je!",
                }
            )
        )

        tables = [
            props.PropsUIPromptConsentFormTable(
                id=table.id,
                number=i,
                title=table.title,
                description=table.description,
                data_frame=table.data_frame,
                headers=table.headers,
            )
            for i, table in enumerate(data, start=1)
        ]

        self.log(f"prompt consent")
        consent_result = yield render_donation_page(
            self.platform,
            [description]
            + tables
            + [
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
            ],
        )

        if consent_result.__type__ == "PayloadJSON":
            self.log(f"donate consent data")
            yield donate(f"{self.session_id}-{self.platform}", consent_result.value)


class DataDonation:
    def __init__(self, platform, mime_types, extractor):
        self.platform = platform
        self.mime_types = mime_types
        self.extractor = extractor

    def __call__(self, session_id, locale="en"):
        processor = DataDonationProcessor(
            self.platform, self.mime_types, self.extractor, session_id, locale
        )
        yield from processor.process()


data_donation = DataDonation("Instagram", "application/zip", extract_data)


def process(data):
    session_id = data.get("sessionId")
    locale = data.get("locale", "en")
    yield donate(f"{session_id}-tracking", '[{ "message": "user entered script" }]')
    yield from data_donation(session_id, locale)


def render_donation_page(platform, body):
    header = props.PropsUIHeader(
        props.Translatable(
            {
                "en": platform,
                "de": platform,
                "it": platform,
                "nl": platform,
            }
        )
    )
    page = props.PropsUIPageDataSubmission(platform, header, body)
    return CommandUIRender(page)


def retry_confirmation(platform):
    text = props.Translatable(
        {
            "en": f"Unfortunately, we cannot process your data. Please make sure that you selected a zip file, and JSON as a file format when downloading your data from Instagram.",
            "de": f"Leider können wir Ihre Daten nicht verarbeiten. Bitte stellen Sie sicher, dass Sie eine ZIP-Datei und JSON als Dateiformat ausgewählt haben, als Sie Ihre Daten von Instagram heruntergeladen haben.",
            "it": f"Purtroppo non possiamo elaborare i tuoi dati. Assicurati di aver selezionato un file ZIP e il formato JSON quando hai scaricato i dati da Instagram.",
            "nl": f"Helaas kunnen we uw gegevens niet verwerken. Zorg ervoor dat u een ZIP-bestand en JSON als bestandsformaat hebt geselecteerd bij het downloaden van uw gegevens van Instagram.",
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
        {
            "en": "Continue",
            "de": "Weiter",
            "it": "Continua",
            "nl": "Verder",
        }
    )
    return props.PropsUIPromptConfirm(text, ok, cancel)


def prompt_consent(id, data, meta_data):
    table_title = props.Translatable(
        {
            "en": "Zip file contents",
            "de": "Inhalt der ZIP-Datei",
            "it": "Contenuto del file ZIP",
            "nl": "Inhoud zipbestand",
        }
    )
    log_title = props.Translatable(
        {
            "en": "Log messages",
            "de": "Protokollnachrichten",
            "it": "Messaggi di log",
            "nl": "Logberichten",
        }
    )

    data_frame = pd.DataFrame(data, columns=["filename", "compressed size", "size"])
    table = props.PropsUIPromptConsentFormTable("zip_content", table_title, data_frame)
    meta_frame = pd.DataFrame(meta_data, columns=["type", "message"])
    meta_table = props.PropsUIPromptConsentFormTable(
        "log_messages", log_title, meta_frame
    )

    return props.PropsUIPromptConsentForm([table], [meta_table])


def donate(key, json_string):
    return CommandSystemDonate(key, json_string)


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        print(extract_data(sys.argv[1]))
    else:
        print("please provide a zip file as argument")
