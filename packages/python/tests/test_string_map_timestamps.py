import pytest
import json
import zipfile
import tempfile
import os
from datetime import datetime
import sys
import os

# Add the port package to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'port'))

from script import get_string_map_timestamps, parse_datetime


class TestGetStringMapTimestamps:
    """Test the get_string_map_timestamps function to ensure it handles both list and non-list data formats."""

    def create_test_zip_with_data(self, data, filename="test_comments.json"):
        """Helper method to create a zip file with test data."""
        temp_dir = tempfile.mkdtemp()
        zip_path = os.path.join(temp_dir, "test.zip")

        with zipfile.ZipFile(zip_path, 'w') as zf:
            zf.writestr(filename, json.dumps(data))

        return zip_path

    def test_list_format_data(self):
        """Test that the function handles list format data correctly (current Instagram format)."""
        # This represents the current Instagram export format - a list of comment objects
        list_data = [
            {
                "string_map_data": {
                    "Comment": {"value": "Great post!"},
                    "Time": {"timestamp": 1640995200}  # 2022-01-01 00:00:00 UTC
                }
            },
            {
                "string_map_data": {
                    "Comment": {"value": "Nice photo!"},
                    "Time": {"timestamp": 1641081600}  # 2022-01-02 00:00:00 UTC
                }
            }
        ]

        zip_path = self.create_test_zip_with_data(list_data, "test/comments/post_comments_1.json")

        with zipfile.ZipFile(zip_path) as zipfile_obj:
            timestamps = list(get_string_map_timestamps(zipfile_obj, "*/comments/post_comments_*.json"))

        # Should extract both timestamps
        assert len(timestamps) == 2

        # Verify the timestamps are parsed correctly
        expected_timestamps = [
            parse_datetime(1640995200),
            parse_datetime(1641081600)
        ]
        assert timestamps == expected_timestamps

        # Clean up
        os.unlink(zip_path)

    def test_single_object_format_data(self):
        """Test that the function handles single object format data correctly (edge case that caused the bug)."""
        # This represents an edge case where the JSON contains a single object instead of a list
        single_object_data = {
            "string_map_data": {
                "Comment": {"value": "Single comment"},
                "Time": {"timestamp": 1640995200}  # 2022-01-01 00:00:00 UTC
            }
        }

        zip_path = self.create_test_zip_with_data(single_object_data, "test/comments/post_comments_1.json")

        with zipfile.ZipFile(zip_path) as zipfile_obj:
            timestamps = list(get_string_map_timestamps(zipfile_obj, "*/comments/post_comments_*.json"))

        # Should extract one timestamp
        assert len(timestamps) == 1

        # Verify the timestamp is parsed correctly
        expected_timestamp = parse_datetime(1640995200)
        assert timestamps[0] == expected_timestamp

        # Clean up
        os.unlink(zip_path)

    def test_mixed_formats_in_different_files(self):
        """Test handling when different files have different formats (list vs single object)."""
        list_data = [
            {
                "string_map_data": {
                    "Comment": {"value": "Comment from list"},
                    "Time": {"timestamp": 1640995200}
                }
            }
        ]

        single_object_data = {
            "string_map_data": {
                "Comment": {"value": "Comment from object"},
                "Time": {"timestamp": 1641081600}
            }
        }

        temp_dir = tempfile.mkdtemp()
        zip_path = os.path.join(temp_dir, "test.zip")

        with zipfile.ZipFile(zip_path, 'w') as zf:
            # Add both formats to the zip
            zf.writestr("test/comments/post_comments_1.json", json.dumps(list_data))
            zf.writestr("test/comments/post_comments_2.json", json.dumps(single_object_data))

        with zipfile.ZipFile(zip_path) as zipfile_obj:
            timestamps = list(get_string_map_timestamps(zipfile_obj, "*/comments/post_comments_*.json"))

        # Should extract both timestamps regardless of format
        assert len(timestamps) == 2

        # Clean up
        os.unlink(zip_path)

    def test_with_key_parameter(self):
        """Test the function when using the key parameter to extract nested data."""
        # Test data with nested structure
        nested_data = {
            "comments_data": [
                {
                    "string_map_data": {
                        "Comment": {"value": "Nested comment"},
                        "Time": {"timestamp": 1640995200}
                    }
                }
            ]
        }

        zip_path = self.create_test_zip_with_data(nested_data, "test/comments/post_comments_1.json")

        with zipfile.ZipFile(zip_path) as zipfile_obj:
            timestamps = list(get_string_map_timestamps(zipfile_obj, "*/comments/post_comments_*.json", "comments_data"))

        # Should extract one timestamp from the nested data
        assert len(timestamps) == 1
        expected_timestamp = parse_datetime(1640995200)
        assert timestamps[0] == expected_timestamp

        # Clean up
        os.unlink(zip_path)

    def test_empty_data(self):
        """Test that the function handles empty data gracefully."""
        empty_list = []

        zip_path = self.create_test_zip_with_data(empty_list, "test/comments/post_comments_1.json")

        with zipfile.ZipFile(zip_path) as zipfile_obj:
            timestamps = list(get_string_map_timestamps(zipfile_obj, "*/comments/post_comments_*.json"))

        # Should return empty list for empty data
        assert len(timestamps) == 0

        # Clean up
        os.unlink(zip_path)


if __name__ == "__main__":
    pytest.main([__file__])