import io
import zipfile
import pandas as pd
import pytest

from port.script import aggregate_daily_steps
from port.script import open_export_zip
from port.script import aggregate_steps_from_zip
from port.script import EmptyHealthDataError
from port.script import InvalidXMLError
from port.script import FileInZipNotFoundError

SAMPLE_XML = """
<HealthData locale="en_NL">
    <Record type="HKQuantityTypeIdentifierStepCount" startDate="2023-06-24 23:10:45 +0100" value="5"/>
    <Record type="HKQuantityTypeIdentifierStepCount" startDate="2023-06-25 09:22:15 +0100" value="18"/>
</HealthData>
"""

def create_test_zip(file_name="apple_health_export/export.xml"):
    """Utility function to create a test ZIP file in-memory using BytesIO."""
    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(zip_buffer, 'w') as test_zip:
        test_zip.writestr(file_name, SAMPLE_XML)
    
    # Reset buffer position to the beginning
    zip_buffer.seek(0)
    return zip_buffer

def test_aggregate_typical_case():
    xml_data = """
    <HealthData locale="en_NL">
     <Record type="HKQuantityTypeIdentifierStepCount" startDate="2023-06-24 23:10:45 +0100" value="5"/>
     <Record type="HKQuantityTypeIdentifierStepCount" startDate="2023-06-25 09:22:15 +0100" value="18"/>
    </HealthData>
    """
    df = aggregate_daily_steps(io.StringIO(xml_data))
    assert df.iloc[0]['Date'] == '2023-06-24'
    assert df.iloc[0]['Steps'] == 5
    assert df.iloc[1]['Date'] == '2023-06-25'
    assert df.iloc[1]['Steps'] == 18

def test_aggregate_same_day():
    xml_data = """
    <HealthData locale="en_NL">
     <Record type="HKQuantityTypeIdentifierStepCount" startDate="2023-06-25 09:22:15 +0100" value="15"/>
     <Record type="HKQuantityTypeIdentifierStepCount" startDate="2023-06-25 10:22:15 +0100" value="25"/>
    </HealthData>
    """
    df = aggregate_daily_steps(io.StringIO(xml_data))
    assert len(df) == 1
    assert df.iloc[0]['Date'] == '2023-06-25'
    assert df.iloc[0]['Steps'] == 40

def test_no_records():
    xml_data = """
    <HealthData locale="en_NL">
    </HealthData>
    """
    with pytest.raises(EmptyHealthDataError):
        aggregate_daily_steps(io.StringIO(xml_data))

def test_empty_input():
    xml_data = ""
    with pytest.raises(InvalidXMLError):
        aggregate_daily_steps(io.StringIO(xml_data))


def test_open_export_zip_valid():
    zip_buffer = create_test_zip()

    with open_export_zip(zip_buffer) as f:
        content = f.read().decode()
        assert SAMPLE_XML in content

def test_open_export_zip_invalid_file():
    zip_buffer = create_test_zip("other.xml")
    
    with pytest.raises(FileInZipNotFoundError):
        with open_export_zip(zip_buffer) as f:
            pass

def test_aggregate_steps_from_zip():
    zip_buffer = create_test_zip()

    df = aggregate_steps_from_zip(zip_buffer)  # using default function
    assert not df.empty