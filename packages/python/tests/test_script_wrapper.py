"""Tests for ScriptWrapper FlushLogs sentinel handling and log queue draining."""

import logging
import sys
import types
from pathlib import Path

# Add packages/python to sys.path so the `port` package resolves.
sys.path.insert(0, str(Path(__file__).parent.parent))

# Stub `port.script` and `port.api.file_utils` before importing `port.main`.
# Their real modules pull in pandas (via props.py) and Pyodide-only `js`
# respectively, neither of which is needed for testing the wrapper.
_fake_script = types.ModuleType("port.script")
_fake_script.process = lambda *_: iter([])
sys.modules["port.script"] = _fake_script

_fake_file_utils = types.ModuleType("port.api.file_utils")
_fake_file_utils.AsyncFileAdapter = lambda value: value
sys.modules["port.api.file_utils"] = _fake_file_utils

from port.main import ScriptWrapper  # noqa: E402
from port.api.commands import CommandUIRender, FlushLogs  # noqa: E402


class _StubPage:
    """Stand-in for a CommandUIRender's page argument."""

    def toDict(self):
        return {"__type__": "Page", "value": "stub"}


def _ui_command():
    return CommandUIRender(_StubPage())


def test_flushlogs_sentinel_does_not_become_a_command():
    """Yielding FlushLogs from the script must not surface as a command."""

    def script():
        yield FlushLogs
        yield _ui_command()

    wrapper = ScriptWrapper(script())
    assert wrapper.send(None)["__type__"] == "CommandUIRender"


def test_flushlogs_sentinel_drains_pending_logs_first():
    """Logs queued before FlushLogs must drain before the next command."""
    logger_name = "port.script.test_flushlogs_drain"

    def script():
        logging.getLogger(logger_name).info("first")
        yield FlushLogs
        yield _ui_command()

    wrapper = ScriptWrapper(script())
    wrapper.add_log_handler(logger_name)

    first = wrapper.send(None)
    assert first["__type__"] == "CommandSystemLog"
    assert first["level"] == "info"
    assert first["message"] == "first"

    second = wrapper.send(None)
    assert second["__type__"] == "CommandUIRender"


def test_logs_emitted_after_flushlogs_arrive_on_next_send():
    """Logs emitted after the sentinel surface only on the following send call."""
    logger_name = "port.script.test_flushlogs_subsequent"

    def script():
        yield FlushLogs
        logging.getLogger(logger_name).warning("after")
        yield _ui_command()

    wrapper = ScriptWrapper(script())
    wrapper.add_log_handler(logger_name)

    # First send: queue is empty, script runs to FlushLogs (no logs yet),
    # loops, runs to next yield which logs then yields the command.
    # Wrapper appends command to queue and returns the log first.
    first = wrapper.send(None)
    assert first["__type__"] == "CommandSystemLog"
    assert first["level"] == "warn"
    assert first["message"] == "after"

    second = wrapper.send(None)
    assert second["__type__"] == "CommandUIRender"


def test_stopiteration_yields_systemexit():
    """When the script generator returns, wrapper emits a CommandSystemExit dict."""

    def script():
        if False:
            yield

    wrapper = ScriptWrapper(script())
    result = wrapper.send(None)
    assert result["__type__"] == "CommandSystemExit"
    assert result["code"] == 0
