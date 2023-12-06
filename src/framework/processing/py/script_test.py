from datetime import datetime
import pytest
import zipfile
import csv
import io

from port.script import parse_csv_to_dataframe
from port.script import aggregate_steps_by_day
from port.script import extract
from port.script import extract_data_from_zip


@pytest.fixture
def sample_data():
    return [
        {
            "day_time": "1552262400000",
            "count": "6",
            "deviceuuid": "VfS0qUERdZ",
        }
    ]


@pytest.fixture
def sample_data_multiple_days():
    return [
        {
            "day_time": "1553558400000",
            "count": "6",
            "deviceuuid": "VfS0qUERdZ",
        },
        {
            "day_time": "1553558400000",
            "count": "33",
            "deviceuuid": "UOeaOrcK91",
        },
        {
            "day_time": "1552262400000",
            "count": "118",
            "deviceuuid": "VfS0qUERdZ",
        },
    ]


def test_parse_csv_to_dataframe(sample_data):
    df = parse_csv_to_dataframe(sample_data)
    assert len(df) == 1
    assert df.iloc[0]["stepCount"] == 6
    assert df.iloc[0]["device"] == "VfS0qUERdZ"
    assert isinstance(df.iloc[0]["timestamp"], datetime)


def test_aggregate_steps_by_day(sample_data_multiple_days):
    df = parse_csv_to_dataframe(sample_data_multiple_days)
    aggregated_df = aggregate_steps_by_day(df)

    assert len(aggregated_df) == 3
    assert aggregated_df.iloc[0]["date"] == "2019-03-11"
    assert aggregated_df.iloc[0]["stepCount"] == 118
    assert aggregated_df.iloc[0]["device"] == "VfS0qUERdZ"
    assert aggregated_df.iloc[1]["date"] == "2019-03-26"
    assert aggregated_df.iloc[1]["stepCount"] == 33
    assert aggregated_df.iloc[1]["device"] == "UOeaOrcK91"
    assert aggregated_df.iloc[2]["date"] == "2019-03-26"
    assert aggregated_df.iloc[2]["stepCount"] == 6
    assert aggregated_df.iloc[2]["device"] == "VfS0qUERdZ"


def test_extract_data_from_zip(tmp_path, sample_data):
    path = tmp_path.joinpath("test.zip")
    z = zipfile.ZipFile(path, "w")
    with z.open(
        "test/com.samsung.shealth.step_daily_trend.20231201144022.csv",
        mode="w",
    ) as f, io.TextIOWrapper(f, encoding="utf8") as ft:
        ft.write("com.samsung.shealth.step_daily_trend.20231201144022,6251011,2\n")
        c = csv.DictWriter(ft, sample_data[0].keys())
        c.writeheader()
        c.writerows(sample_data)
    z.close()
    print(extract_data_from_zip(path))
    [result] = extract_data_from_zip(path)
    assert result.title.translations["nl"] == "Stappen per dag"
    assert result.data_frame.iloc[0]["Datum"] == "2019-03-11"
    assert result.data_frame.iloc[0]["Aantal"] == 6
    assert result.data_frame.iloc[0]["Apparaat ID"] == "VfS0qUERdZ"


def test_extract_data_from_zip_with_empty_zip(tmp_path):
    path = tmp_path.joinpath("test.zip")
    z = zipfile.ZipFile(path, "w")
    z.close()
    assert extract_data_from_zip(path) == "no-data"
