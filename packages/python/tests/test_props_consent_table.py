"""Tests for PropsUIPromptConsentFormTable description and column_widths."""

import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from port.api.props import PropsUIPromptConsentFormTable, Translatable


def _table(**kwargs) -> PropsUIPromptConsentFormTable:
    return PropsUIPromptConsentFormTable(
        "messages",
        1,
        Translatable({"en": "Messages"}),
        Translatable({"en": ""}),
        pd.DataFrame({"role": ["user"], "message": ["hi"]}),
        **kwargs,
    )


def test_column_widths_serialize_by_column_name():
    d = _table(column_widths={"message": 3}).toDict()
    assert d["column_widths"] == {"message": 3}


@pytest.mark.parametrize("width", [0, -1, float("nan")])
def test_non_positive_column_widths_are_rejected(width):
    with pytest.raises(ValueError, match="message"):
        _table(column_widths={"message": width})


def test_description_can_be_omitted():
    table = PropsUIPromptConsentFormTable(
        "messages", 1, Translatable({"en": "Messages"}), data_frame=pd.DataFrame({"a": [1]})
    )
    assert "description" not in table.toDict()


def test_missing_data_frame_is_rejected():
    # Passing the data frame positionally without a description lands it in the description slot.
    with pytest.raises(TypeError, match="data_frame="):
        PropsUIPromptConsentFormTable("messages", 1, Translatable({"en": "Messages"}), pd.DataFrame({"a": [1]}))
