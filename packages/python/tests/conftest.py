"""
pytest configuration file to mock dependencies that aren't available in test environment.

This file is loaded by pytest before any tests run, allowing us to set up mocks
for modules that have dependencies on browser-specific modules like 'js'.
"""
import sys
from types import ModuleType


# Mock the 'js' module that's only available in browser environments
# This is the only module that needs mocking - port.api modules are real
sys.modules["js"] = ModuleType("js")
