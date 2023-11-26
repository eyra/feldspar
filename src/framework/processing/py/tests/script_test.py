from datetime import datetime
import pytest
import zipfile


from port.script import parse_json_to_dataframe
from port.script import aggregate_distance_by_day_activity
from port.script import extract
from port.script import extract_data_from_zip


@pytest.fixture
def sample_data():
    return {
        "timelineObjects": [
            {
                "activitySegment": {
                    "duration": {"startTimestamp": "2023-04-01T19:13:27.023Z"},
                    "activityType": "CYCLING",
                    "waypointPath": {"distanceMeters": 3600.33},
                }
            }
        ]
    }


@pytest.fixture
def sample_data_multiple_activities():
    return {
        "timelineObjects": [
            {
                "activitySegment": {
                    "duration": {"startTimestamp": "2023-04-01T19:13:27.023Z"},
                    "activityType": "CYCLING",
                    "waypointPath": {"distanceMeters": 3600.33},
                }
            },
            {
                "activitySegment": {
                    "duration": {"startTimestamp": "2023-04-01T20:13:27.023Z"},
                    "activityType": "CYCLING",
                    "waypointPath": {"distanceMeters": 1400.0},
                }
            },
            {
                "activitySegment": {
                    "duration": {"startTimestamp": "2023-04-02T08:13:27.023Z"},
                    "activityType": "WALKING",
                    "waypointPath": {"distanceMeters": 800.5},
                }
            },
            {
                "activitySegment": {
                    "duration": {"startTimestamp": "2023-04-01T19:13:27.023Z"},
                    "activityType": "RUNNING",
                    "waypointPath": {"distanceMeters": 3600.33},
                }
            },
            {
                "activitySegment": {
                    "duration": {"startTimestamp": "2023-04-01T20:13:27.023Z"},
                    "activityType": "RUNNING",
                    "waypointPath": {"distanceMeters": 1400.0},
                }
            },
        ]
    }


def test_parse_json_to_dataframe(sample_data):
    df = parse_json_to_dataframe(sample_data)
    assert len(df) == 1
    assert df.iloc[0]["activityType"] == "CYCLING"
    assert df.iloc[0]["distanceMeters"] == 3600.33
    assert isinstance(df.iloc[0]["startTimestamp"], datetime)


def test_parse_json_to_dataframe_skips_non_walking_or_cycling():
    parsed_dict = {
        "timelineObjects": [
            {
                "activitySegment": {
                    "activityType": "WALKING",
                    "duration": {"startTimestamp": "2023-09-17T10:00:00Z"},
                    "waypointPath": {"distanceMeters": 1000},
                }
            },
            {
                "activitySegment": {
                    "activityType": "CYCLING",
                    "duration": {"startTimestamp": "2023-09-17T11:00:00Z"},
                    "waypointPath": {"distanceMeters": 5000},
                }
            },
            {
                "activitySegment": {
                    "activityType": "DRIVING",
                    "duration": {"startTimestamp": "2023-09-17T12:00:00Z"},
                    "waypointPath": {"distanceMeters": 20000},
                }
            },
        ]
    }

    df = parse_json_to_dataframe(parsed_dict)
    assert "DRIVING" not in df.activityType.values


def test_aggregate_distance_by_day_activity(sample_data):
    df = parse_json_to_dataframe(sample_data)
    aggregated_df = aggregate_distance_by_day_activity(df)

    assert len(aggregated_df) == 1
    assert aggregated_df.iloc[0]["startTimestamp"] == "2023-04-01"
    assert aggregated_df.iloc[0]["activityType"] == "CYCLING"
    assert aggregated_df.iloc[0]["distanceMeters"] == 3600.33


def test_aggregation_over_multiple_activities(sample_data_multiple_activities):
    df = parse_json_to_dataframe(sample_data_multiple_activities)
    aggregated_df = aggregate_distance_by_day_activity(df)

    # Verify that there are 2 aggregated entries (one for each day)
    assert len(aggregated_df) == 3

    # For 2023-04-01, there were two cycling activities. We sum their distances.
    cycling_data = aggregated_df[(aggregated_df["activityType"] == "CYCLING")]
    assert len(cycling_data) == 1
    assert cycling_data.iloc[0]["distanceMeters"] == (3600.33 + 1400.0)

    # For 2023-04-02, there was one walking activity.
    walking_data = aggregated_df[aggregated_df["activityType"] == "WALKING"]
    assert len(walking_data) == 1
    assert walking_data.iloc[0]["distanceMeters"] == 800.5

    # For 2023-05-02, there was one running activity.
    walking_data = aggregated_df[aggregated_df["activityType"] == "RUNNING"]
    assert len(walking_data) == 1
    assert walking_data.iloc[0]["distanceMeters"] == (3600.33 + 1400.0)


def test_extract_sample_data(sample_data):
    results = extract(parse_json_to_dataframe(sample_data))
    # Verify the results
    assert len(results) == 1
    assert results[0].id == "cycling"
    assert results[0].title.translations["nl"] == "Gefietst"
    for result in results:
        assert "distanceMeters" not in result.data_frame.columns
        assert "Afstand in km" in result.data_frame.columns

def test_empty_zip(tmp_path):
    path = tmp_path.joinpath("test.zip")
    z = zipfile.ZipFile(path, "w")
    z.close()
    assert extract_data_from_zip(path) == "no-data"