"""CLI runner for local extraction debugging.

Drives extract_data() directly — no browser or Pyodide needed. Useful for
testing script.py against a real zip file from the terminal.

Usage:
    cd packages/python
    python -m port path/to/file.zip
"""

import sys
import json
import pandas as pd
from port.api.commands import FlushLogs


def _get_translation(obj: dict, default: str = "") -> str:
    return obj.get("translations", {}).get("en", default)


def _print_table(component: dict) -> None:
    title = _get_translation(component.get("title", {}))
    desc = _get_translation(component.get("description", {}))
    print(f"\n  📊 {title}")
    if desc:
        print(f"     {desc}")
    df_data = json.loads(component.get("data_frame", "{}"))
    df = pd.DataFrame(df_data)
    if not df.empty:
        total = len(df)
        print(f"     {total} row(s):")
        for line in df.head(5).to_string(index=False).split("\n"):
            print(f"     {line}")
        if total > 5:
            print(f"     ... and {total - 5} more rows")


def main():
    if len(sys.argv) < 2:
        print("Usage: python -m port path/to/file.zip")
        sys.exit(1)

    zip_path = sys.argv[1]
    print(f"Extracting: {zip_path}\n")

    from port.script import extract_data

    gen = extract_data(zip_path)
    results = None
    try:
        while True:
            next(gen)  # consume FlushLogs sentinels; progress logs go to the logging handler
    except StopIteration as e:
        results = e.value

    if not results:
        print("Extraction returned no results.")
        sys.exit(1)

    for result in results:
        component = {
            "__type__": "PropsUIPromptConsentFormTable",
            "title": {"translations": {"en": result.name.replace("_", " ").title()}},
            "description": {"translations": {"en": ""}},
            "data_frame": result.data_frame.to_json(),
        }
        _print_table(component)

    print("\nDone.")
