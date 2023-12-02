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
            "com.samsung.health.step_count.create_time": "2023-06-15 16:56:30.171",
            "com.samsung.health.step_count.count": "6",
        }
    ]


@pytest.fixture
def sample_data_multiple_days():
    return [
        {
            "com.samsung.health.step_count.create_time": "2023-06-15 16:56:30.171",
            "com.samsung.health.step_count.count": "6",
        },
        {
            "com.samsung.health.step_count.create_time": "2023-06-15 17:51:18.314",
            "com.samsung.health.step_count.count": "33",
        },
        {
            "com.samsung.health.step_count.create_time": "2023-06-17 21:32:08.369",
            "com.samsung.health.step_count.count": "118",
        },
    ]


def test_parse_csv_to_dataframe(sample_data):
    df = parse_csv_to_dataframe(sample_data)
    assert len(df) == 1
    assert df.iloc[0]["stepCount"] == 6
    assert isinstance(df.iloc[0]["timestamp"], datetime)


def test_aggregate_steps_by_day(sample_data_multiple_days):
    df = parse_csv_to_dataframe(sample_data_multiple_days)
    aggregated_df = aggregate_steps_by_day(df)

    assert len(aggregated_df) == 2
    assert aggregated_df.iloc[0]["date"] == "2023-06-15"
    assert aggregated_df.iloc[0]["stepCount"] == 39
    assert aggregated_df.iloc[1]["date"] == "2023-06-17"
    assert aggregated_df.iloc[1]["stepCount"] == 118


def test_extract_data_from_zip(tmp_path, sample_data):
    path = tmp_path.joinpath("test.zip")
    z = zipfile.ZipFile(path, "w")
    with z.open(
        "test/com.samsung.shealth.tracker.pedometer_step_count.20230626112282.csv",
        mode="w",
    ) as f, io.TextIOWrapper(f, encoding="utf8") as ft:
        ft.write("com.samsung.shealth.tracker.pedometer_step_count,6251011,2\n")
        c = csv.DictWriter(ft, sample_data[0].keys())
        c.writeheader()
        c.writerows(sample_data)
    z.close()
    [result] = extract_data_from_zip(path)
    assert result.title.translations["nl"] == "Stappen per dag"
    assert result.data_frame.iloc[0]["Datum"] == "2023-06-15"
    assert result.data_frame.iloc[0]["Aantal"] == 6


def test_extract_data_from_zip_with_empty_zip(tmp_path):
    path = tmp_path.joinpath("test.zip")
    z = zipfile.ZipFile(path, "w")
    z.close()
    assert extract_data_from_zip(path) == "no-data"
