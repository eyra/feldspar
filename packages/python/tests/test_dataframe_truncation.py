import importlib.util
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
    """Tests for data frame truncation in PropsUIPromptConsentFormTable"""

    def test_dataframe_under_max_size_unchanged(self):
        """DataFrame smaller than max_size should not be truncated"""
        df = make_dataframe(100)
        table = PropsUIPromptConsentFormTable(
            id="test",
            number=1,
            title=make_translatable("Test"),
            description=make_translatable("Description"),
            data_frame=df,
            data_frame_max_size=10000,
        )
        assert len(table.data_frame) == 100

    def test_dataframe_at_max_size_unchanged(self):
        """DataFrame exactly at max_size should not be truncated"""
        df = make_dataframe(500)
        table = PropsUIPromptConsentFormTable(
            id="test",
            number=1,
            title=make_translatable("Test"),
            description=make_translatable("Description"),
            data_frame=df,
            data_frame_max_size=500,
        )
        assert len(table.data_frame) == 500

    def test_dataframe_over_max_size_truncated(self):
        """DataFrame larger than max_size should be truncated"""
        df = make_dataframe(1000)
        table = PropsUIPromptConsentFormTable(
            id="test",
            number=1,
            title=make_translatable("Test"),
            description=make_translatable("Description"),
            data_frame=df,
            data_frame_max_size=500,
        )
        assert len(table.data_frame) == 500

    def test_truncation_keeps_first_rows(self):
        """Truncation should keep the first N rows"""
        df = make_dataframe(100)
        table = PropsUIPromptConsentFormTable(
            id="test",
            number=1,
            title=make_translatable("Test"),
            description=make_translatable("Description"),
            data_frame=df,
            data_frame_max_size=10,
        )
        assert list(table.data_frame["col1"]) == list(range(10))
        assert list(table.data_frame["col2"]) == [f"row_{i}" for i in range(10)]

    def test_truncation_resets_index(self):
        """Truncated DataFrame should have reset index"""
        df = make_dataframe(100)
        table = PropsUIPromptConsentFormTable(
            id="test",
            number=1,
            title=make_translatable("Test"),
            description=make_translatable("Description"),
            data_frame=df,
            data_frame_max_size=10,
        )
        assert list(table.data_frame.index) == list(range(10))

    def test_custom_max_size(self):
        """Custom max_size should be respected"""
        df = make_dataframe(200)
        table = PropsUIPromptConsentFormTable(
            id="test",
            number=1,
            title=make_translatable("Test"),
            description=make_translatable("Description"),
            data_frame=df,
            data_frame_max_size=50,
        )
        assert len(table.data_frame) == 50

    def test_max_size_zero_defaults_to_one(self):
        """max_size of 0 should default to 1"""
        df = make_dataframe(100)
        table = PropsUIPromptConsentFormTable(
            id="test",
            number=1,
            title=make_translatable("Test"),
            description=make_translatable("Description"),
            data_frame=df,
            data_frame_max_size=0,
        )
        assert table.data_frame_max_size == 1
        assert len(table.data_frame) == 1

    def test_max_size_negative_defaults_to_one(self):
        """Negative max_size should default to 1"""
        df = make_dataframe(100)
        table = PropsUIPromptConsentFormTable(
            id="test",
            number=1,
            title=make_translatable("Test"),
            description=make_translatable("Description"),
            data_frame=df,
            data_frame_max_size=-5,
        )
        assert table.data_frame_max_size == 1
        assert len(table.data_frame) == 1

    def test_default_max_size_is_10000(self):
        """Default max_size should be 10000"""
        df = make_dataframe(100)
        table = PropsUIPromptConsentFormTable(
            id="test",
            number=1,
            title=make_translatable("Test"),
            description=make_translatable("Description"),
            data_frame=df,
        )
        assert table.data_frame_max_size == 10000
