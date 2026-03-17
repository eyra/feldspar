import csv
import io
import json
import os
import pytz

from abc import ABC, abstractmethod
from enum import Enum
from datetime import datetime


SEARCH_PREFIXES = [
    "Searched for ",
]

SEARCH_WATCH_PREFIXES = [
    "Watched ",
    # "Viewed ", << prefix to be discussed
]

WATCH_PREFIXES = [
    "Watched ",
    # "Viewed ", << prefix to be discussed
]


class ParseResult(Enum):
    FILES_NOT_FOUND = "files_not_found"
    FILE_INCORRECT_FORMAT = "file_incorrect_format"
    FILE_PARSED = "file_parsed"
    FILE_PROCESSED = "file_processed"


class YoutubeParser(ABC):

    def __init__(self):
        self.parse_result = None

    def is_relevant_file(self, file_name):
        return bool(file_name) and "__MACOSX" not in file_name and self._is_target_file(file_name)

    def parse_files(self, extracted_files):
        try:
            for file_name, file_content in extracted_files:
                if self.is_relevant_file(file_name) and file_content:
                    self._parse_file(file_name, file_content)
            self.parse_result = ParseResult.FILE_PARSED if self._has_data() else ParseResult.FILES_NOT_FOUND
        except (json.JSONDecodeError, ValueError, UnicodeDecodeError) as e:
            print(f"Error parsing {self.__class__.__name__}: {e}")
            self.parse_result = ParseResult.FILE_INCORRECT_FORMAT
        return self.parse_result

    def _convert_to_et(self, iso_str):
        dt_utc = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        dt_utc = pytz.UTC.localize(dt_utc.replace(tzinfo=None))
        dt_et = dt_utc.astimezone(pytz.timezone("US/Eastern"))
        return dt_et.strftime("%Y-%m-%d %I:%M %p %Z")

    @abstractmethod
    def _is_target_file(self, file_name) -> bool: ...

    @abstractmethod
    def _parse_file(self, file_name, file_content): ...

    @abstractmethod
    def _has_data(self) -> bool: ...


class YoutubeHistoryParser(YoutubeParser):

    def __init__(self):
        super().__init__()
        self.search_json = []
        self.watch_json = []
        self.search_history = []
        self.search_watch_history = []
        self.watch_history = []
        self.search_file_name = "search-history.json"
        self.watch_file_name = "watch-history.json"

    def _is_target_file(self, file_name):
        return os.path.basename(file_name) in (self.search_file_name, self.watch_file_name)

    def _has_data(self):
        return bool(self.search_json or self.watch_json)

    def process_histories(self):
        self.search_history = self._process_history(self.search_json, SEARCH_PREFIXES)
        self.search_watch_history = self._process_history(
            self.search_json, SEARCH_WATCH_PREFIXES
        )
        self.watch_history = self._process_history(self.watch_json, WATCH_PREFIXES)
        self.parse_result = ParseResult.FILE_PROCESSED
        return self.parse_result

    def _parse_file(self, file_name, file_content):
        print(f"Parsing file: {file_name}")

        json_data = json.loads(file_content.decode("utf-8", errors="ignore"))

        print(f"File parsed: {len(json_data)} records")

        if not isinstance(json_data, list) or not all(
            isinstance(item, dict) for item in json_data
        ):
            raise ValueError("Incorrect file format")

        if os.path.basename(file_name) == self.search_file_name:
            self.search_json = json_data
        elif os.path.basename(file_name) == self.watch_file_name:
            self.watch_json = json_data

    def _process_history(self, json_data, prefixes):
        result = []
        for item in json_data:
            for prefix in prefixes:
                if item.get("title", "").startswith(prefix):
                    result.append({
                        **item,
                        "title": item["title"][len(prefix):].strip(),
                        "time": self._convert_to_et(item["time"]),
                    })
        return result


class YoutubeSubscriptionsParser(YoutubeParser):

    def __init__(self):
        super().__init__()
        self.subscriptions = []
        self.subscriptions_file_name = "subscriptions.csv"

    def _is_target_file(self, file_name):
        return os.path.basename(file_name) == self.subscriptions_file_name

    def _has_data(self):
        return bool(self.subscriptions)

    def _parse_file(self, file_name, file_content):
        text = file_content.decode("utf-8", errors="ignore")
        reader = csv.DictReader(io.StringIO(text))
        for row in reader:
            row_lower = {k.lower(): v for k, v in row.items()}
            self.subscriptions.append({
                "channel_title": row_lower.get("channel title", ""),
                "channel_url": row_lower.get("channel url", ""),
            })
        print(f"Subscriptions parsed: {len(self.subscriptions)} records")


class YoutubeUploadedVideosParser(YoutubeParser):

    def __init__(self):
        super().__init__()
        self.videos = []
        self.videos_file_name = "videos.csv"

    def _is_target_file(self, file_name):
        return os.path.basename(file_name) == self.videos_file_name

    def _has_data(self):
        return bool(self.videos)

    def _parse_file(self, file_name, file_content):
        text = file_content.decode("utf-8", errors="ignore")
        reader = csv.DictReader(io.StringIO(text))
        for row in reader:
            raw_ts = row.get("Video publish timestamp", "")
            self.videos.append({
                "video_publish_timestamp": self._convert_to_et(raw_ts) if raw_ts else "",
                "video_title": row.get("Video title (original)", ""),
                "video_category": row.get("Video category", ""),
                "privacy": row.get("Privacy", ""),
            })
        print(f"Uploaded videos parsed: {len(self.videos)} records")
