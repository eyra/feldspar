import json
import pytz

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
    JSON_PARSED = "json_parsed"
    JSON_PROCESSED = "json_processed"


class YoutubeHistoryParser:

    def __init__(self):
        self.search_json = []
        self.watch_json = []
        self.search_history = []
        self.search_watch_history = []
        self.watch_history = []
        self.parse_result = None
        self.search_file_name = "search-history.json"
        self.watch_file_name = "watch-history.json"

    def parse_files(self, extracted_files):
        try:
            for file_name, file_content in extracted_files:
                self._parse_file(file_name, file_content)
            self.parse_result = (
                ParseResult.JSON_PARSED
                if (self.search_json or self.watch_json)
                else ParseResult.FILES_NOT_FOUND
            )
        except (json.JSONDecodeError, ValueError) as e:
            print(f"Error parsing files: {e}")
            self.parse_result = ParseResult.FILE_INCORRECT_FORMAT
        return self.parse_result

    def process_histories(self):
        self.search_history = self._process_history(self.search_json, SEARCH_PREFIXES)
        self.search_watch_history = self._process_history(
            self.search_json, SEARCH_WATCH_PREFIXES
        )
        self.watch_history = self._process_history(self.watch_json, WATCH_PREFIXES)
        self.parse_result = ParseResult.JSON_PROCESSED
        return self.parse_result

    def _parse_file(self, file_name, file_content):
        if not self._validate_file(file_name, file_content):
            return

        print(f"Parsing file: {file_name}")

        json_data = json.loads(file_content.decode("utf-8", errors="ignore"))

        print(f"File parsed: {len(json_data)} records")

        if not isinstance(json_data, list) or not all(
            isinstance(item, dict) for item in json_data
        ):
            raise ValueError("Incorrect file format")

        if file_name.endswith(self.search_file_name):
            self.search_json = json_data
        elif file_name.endswith(self.watch_file_name):
            self.watch_json = json_data

    def _validate_file(self, file_name, file_content):
        return (
            bool(file_name and file_content)
            and "__MACOSX" not in file_name
            and self._is_known_filename(file_name)
        )

    def _is_known_filename(self, file_name):
        return file_name.endswith((self.search_file_name, self.watch_file_name))

    def _process_history(self, json_data, prefixes):
        return [
            {
                **item,
                "title": item["title"][len(prefix) :].strip(),
                "time": self._convert_to_et(item["time"]),
            }
            for item in json_data
            for prefix in prefixes
            if item.get("title", "").startswith(prefix)
        ]

    def _convert_to_et(self, iso_str):
        dt_utc = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        dt_utc = pytz.UTC.localize(dt_utc.replace(tzinfo=None))
        dt_et = dt_utc.astimezone(pytz.timezone("US/Eastern"))
        return dt_et.strftime("%Y-%m-%d %I:%M %p %Z")
