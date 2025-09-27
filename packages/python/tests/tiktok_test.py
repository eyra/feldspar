import pytest
import json
import zipfile
import io
from datetime import datetime
from port.script import extract_tiktok_data, ExtractionResult


def create_test_zip(data):
    """Helper function to create a zip file in memory with test data"""
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        zip_file.writestr("user_data.json", json.dumps(data))
    zip_buffer.seek(0)
    return zip_buffer


def test_extract_tiktok_data_empty_zip():
    """Test extraction with empty zip file"""
    empty_zip = create_test_zip({})
    result = extract_tiktok_data(empty_zip, "en")
    assert result == []


def test_extract_tiktok_data_valid_data():
    """Test extraction with valid TikTok data"""
    test_data = {
        "Profile": {
            "Profile Information": {
                "ProfileMap": {"userName": "testuser", "likesReceived": 100}
            }
        },
        "Activity": {
            "Follower List": {"FansList": []},
            "Following List": {"Following": []},
            "Like List": {"ItemFavoriteList": []},
            "Video Browsing History": {"VideoList": []},
        },
        "Video": {"Videos": {"VideoList": []}},
        "Comment": {"Comments": {"CommentsList": []}},
        "Direct Messages": {"Chat History": {"ChatHistory": {}}},
    }

    test_zip = create_test_zip(test_data)
    result = extract_tiktok_data(test_zip, "en")

    assert len(result) > 0
    assert all(isinstance(item, ExtractionResult) for item in result)

    # Check if summary data is present
    summary_data = next((r for r in result if r.id == "tiktok_summary"), None)
    assert summary_data is not None
    assert summary_data.title is not None
    assert len(summary_data.data_frame) > 0


def test_extract_tiktok_data_with_messages():
    """Test extraction with direct messages data"""
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    test_data = {
        "Profile": {"Profile Information": {"ProfileMap": {"userName": "testuser"}}},
        "Direct Messages": {
            "Chat History": {
                "ChatHistory": {
                    "chat1": [
                        {"From": "testuser", "Date": current_time},
                        {"From": "otheruser", "Date": current_time},
                    ]
                }
            }
        },
    }

    test_zip = create_test_zip(test_data)
    result = extract_tiktok_data(test_zip, "en")

    # Find direct messages result
    messages_data = next((r for r in result if r.id == "tiktok_direct_messages"), None)
    assert messages_data is not None
    assert len(messages_data.data_frame) == 2
    assert "Anonymous ID" in messages_data.data_frame.columns
    assert "Sent" in messages_data.data_frame.columns


def test_extract_tiktok_data_invalid_json():
    """Test extraction with invalid JSON data"""
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        zip_file.writestr("user_data.json", "invalid json")
    zip_buffer.seek(0)

    result = extract_tiktok_data(zip_buffer, "en")
    assert result == []


def test_extract_tiktok_data_with_video_posts():
    """Test extraction with video posts data"""
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    test_data = {
        "Profile": {"Profile Information": {"ProfileMap": {"userName": "testuser"}}},
        "Video": {"Videos": {"VideoList": [{"Date": current_time, "Likes": "10"}]}},
    }

    test_zip = create_test_zip(test_data)
    result = extract_tiktok_data(test_zip, "en")

    # Find video posts result
    video_data = next((r for r in result if r.id == "tiktok_posts"), None)
    assert video_data is not None
    assert len(video_data.data_frame) > 0
    assert "Videos" in video_data.data_frame.columns
    assert "Likes received" in video_data.data_frame.columns


def test_extract_videos_viewed():
    """Test extraction of viewed videos data"""
    test_data = {
        "Profile": {"Profile Information": {"ProfileMap": {"userName": "testuser"}}},
        "Activity": {
            "Video Browsing History": {
                "VideoList": [
                    {
                        "Date": "2024-12-20 15:20:38",
                        "Link": "https://www.tiktokv.com/share/video/1111111111111111111/",
                    },
                    {
                        "Date": "2024-12-20 18:21:38",
                        "Link": "https://www.tiktokv.com/share/video/2222222222222222222/",
                    },
                ]
            }
        },
    }

    test_zip = create_test_zip(test_data)
    result = extract_tiktok_data(test_zip, "en")

    # Find videos viewed result
    videos_viewed = next((r for r in result if r.id == "tiktok_videos_viewed"), None)
    assert videos_viewed is not None
    assert len(videos_viewed.data_frame) == 2
    assert all(
        col in videos_viewed.data_frame.columns for col in ["Date", "Timeslot", "Link"]
    )
    assert (
        videos_viewed.data_frame.iloc[0]["Link"]
        == "https://www.tiktokv.com/share/video/1111111111111111111/"
    )
    assert videos_viewed.data_frame.iloc[0]["Date"] == "2024-12-20 15:20:38"


def test_extract_session_info():
    """Test extraction of session information"""
    test_data = {
        "Profile": {"Profile Information": {"ProfileMap": {"userName": "testuser"}}},
        "Activity": {
            "Video Browsing History": {
                "VideoList": [
                    {"Date": "2024-12-20 15:20:38"},
                    {"Date": "2024-12-20 15:21:38"},  # Same session
                    {"Date": "2024-12-20 18:21:38"},  # New session (> 5 min gap)
                ]
            }
        },
    }

    test_zip = create_test_zip(test_data)
    result = extract_tiktok_data(test_zip, "en")

    # Find session info result
    session_info = next((r for r in result if r.id == "tiktok_session_info"), None)
    assert session_info is not None
    assert len(session_info.data_frame) == 2  # Should have 2 sessions
    assert all(
        col in session_info.data_frame.columns
        for col in ["Start", "Duration (in minutes)"]
    )


def test_extract_comments_and_likes():
    """Test extraction of comments and likes data"""
    test_data = {
        "Profile": {"Profile Information": {"ProfileMap": {"userName": "testuser"}}},
        "Comment": {
            "Comments": {
                "CommentsList": [
                    {
                        "date": "2023-10-31 08:04:12",
                        "comment": "Great post! 📚",
                        "photo": "N/A",
                        "url": "",
                    }
                ]
            }
        },
        "Activity": {
            "Like List": {"ItemFavoriteList": [{"Date": "2023-10-31 08:04:12"}]}
        },
    }

    test_zip = create_test_zip(test_data)
    result = extract_tiktok_data(test_zip, "en")

    # Find comments and likes result
    comments_likes = next(
        (r for r in result if r.id == "tiktok_comments_and_likes"), None
    )
    assert comments_likes is not None
    assert all(
        col in comments_likes.data_frame.columns
        for col in ["Date", "Timeslot", "Comment posts", "Likes given"]
    )
    assert comments_likes.data_frame["Comment posts"].sum() > 0
    assert comments_likes.data_frame["Likes given"].sum() > 0


def test_extract_direct_messages():
    """Test extraction of direct messages"""
    test_data = {
        "Profile": {"Profile Information": {"ProfileMap": {"userName": "testuser"}}},
        "Direct Messages": {
            "Chat History": {
                "ChatHistory": {
                    "chat1": [
                        {"From": "testuser", "Date": "2024-12-20 15:20:38"},
                        {"From": "otheruser", "Date": "2024-12-20 15:21:38"},
                    ]
                }
            }
        },
    }

    test_zip = create_test_zip(test_data)
    result = extract_tiktok_data(test_zip, "en")

    # Find direct messages result
    messages = next((r for r in result if r.id == "tiktok_direct_messages"), None)
    assert messages is not None
    assert len(messages.data_frame) == 2
    assert all(col in messages.data_frame.columns for col in ["Anonymous ID", "Sent"])
    # Check that testuser (the owner) gets ID 1
    assert 1 in messages.data_frame["Anonymous ID"].values


def test_extract_tiktok_data_with_locale():
    """Test extraction with different locales to verify translation functionality"""
    test_data = {
        "Profile": {
            "Profile Information": {
                "ProfileMap": {"userName": "testuser", "likesReceived": 100}
            }
        },
        "Activity": {
            "Follower List": {"FansList": []},
            "Following List": {"Following": []},
            "Like List": {"ItemFavoriteList": []},
            "Video Browsing History": {"VideoList": []},
        },
        "Video": {"Videos": {"VideoList": []}},
        "Comment": {"Comments": {"CommentsList": []}},
        "Direct Messages": {"Chat History": {"ChatHistory": {}}},
    }

    # Test English locale
    test_zip_en = create_test_zip(test_data)
    result_en = extract_tiktok_data(test_zip_en, "en")
    summary_en = next((r for r in result_en if r.id == "tiktok_summary"), None)
    assert "Followers" in summary_en.data_frame["Description"].values
    assert "Videos published" in summary_en.data_frame["Description"].values

    # Test German locale
    test_zip_de = create_test_zip(test_data)
    result_de = extract_tiktok_data(test_zip_de, "de")
    summary_de = next((r for r in result_de if r.id == "tiktok_summary"), None)
    assert "Follower" in summary_de.data_frame["Description"].values
    assert "Veröffentlichte Videos" in summary_de.data_frame["Description"].values

    # Test Italian locale
    test_zip_it = create_test_zip(test_data)
    result_it = extract_tiktok_data(test_zip_it, "it")
    summary_it = next((r for r in result_it if r.id == "tiktok_summary"), None)
    assert "Follower" in summary_it.data_frame["Description"].values
    assert "Video pubblicati" in summary_it.data_frame["Description"].values

    # Test Dutch locale
    test_zip_nl = create_test_zip(test_data)
    result_nl = extract_tiktok_data(test_zip_nl, "nl")
    summary_nl = next((r for r in result_nl if r.id == "tiktok_summary"), None)
    assert "Volgers" in summary_nl.data_frame["Description"].values
    assert "Gepubliceerde video's" in summary_nl.data_frame["Description"].values

    # Test fallback to English for unsupported locale
    test_zip_unsupported = create_test_zip(test_data)
    result_unsupported = extract_tiktok_data(test_zip_unsupported, "fr")
    summary_unsupported = next((r for r in result_unsupported if r.id == "tiktok_summary"), None)
    assert "Followers" in summary_unsupported.data_frame["Description"].values  # Should fall back to English
