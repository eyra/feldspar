import importlib.util
import json
import sys
from pathlib import Path

import pandas as pd
import pytest

# Import props directly to avoid port/__init__.py which needs Pyodide's js module
props_path = Path(__file__).parent.parent / "port" / "api" / "props.py"
spec = importlib.util.spec_from_file_location("props", props_path)
props = importlib.util.module_from_spec(spec)
sys.modules["props"] = props
spec.loader.exec_module(props)

PropsUIPromptConsentFormTable = props.PropsUIPromptConsentFormTable
Translatable = props.Translatable


def make_translatable(text: str) -> Translatable:
    return Translatable({"en": text, "nl": text})


def make_dataframe(num_rows: int) -> pd.DataFrame:
    return pd.DataFrame({"col1": range(num_rows), "col2": [f"row_{i}" for i in range(num_rows)]})


class TestPropsUIPromptConsentFormTableTruncation:
    @pytest.mark.parametrize(
        ("max_size", "expected_rows"),
        [(0, 1), (-5, 1), (10, 10), (100, 100), (101, 100)],
    )
    def test_numeric_limit_serializes_the_original_prefix(self, max_size, expected_rows):
        table = PropsUIPromptConsentFormTable(
            id="test",
            number=1,
            title=make_translatable("Test"),
            data_frame=make_dataframe(100),
            data_frame_max_size=max_size,
        )

        serialized = json.loads(table.toDict()["data_frame"])

        assert serialized == {
            "col1": {str(i): i for i in range(expected_rows)},
            "col2": {str(i): f"row_{i}" for i in range(expected_rows)},
        }

    def test_none_serializes_every_row_beyond_the_former_javascript_limit(self):
        row_count = 100001
        table = PropsUIPromptConsentFormTable(
            id="test",
            number=1,
            title=make_translatable("Test"),
            data_frame=make_dataframe(row_count),
            data_frame_max_size=None,
        )

        serialized = json.loads(table.toDict()["data_frame"])

        assert serialized == {
            "col1": {str(i): i for i in range(row_count)},
            "col2": {str(i): f"row_{i}" for i in range(row_count)},
        }
