import logging
from collections import deque
from collections.abc import Generator
from port.script import process
from port.api.commands import CommandSystemExit
from port.api.file_utils import AsyncFileAdapter
from port.api.logging import LogForwardingHandler


class ScriptWrapper(Generator):
    def __init__(self, script):
        self.script = script
        self.queue = deque()

    def add_log_handler(self, logger_name="port.script"):
        """Attach a handler to the named logger that forwards log records as CommandSystemLog commands."""
        logger = logging.getLogger(logger_name)
        logger.setLevel(logging.DEBUG)
        logger.addHandler(LogForwardingHandler(self.queue))

    def send(self, data):
        if not self.queue:
            if data and getattr(data, '__type__') == "PayloadFile":
                data.value = AsyncFileAdapter(data.value)
            try:
                command = self.script.send(data)
            except StopIteration:
                return CommandSystemExit(0, "End of script").toDict()
            self.queue.append(command.toDict())

        return self.queue.popleft()

    def throw(self, type=None, value=None, traceback=None):
        raise StopIteration


def start(sessionId):
    script = process(sessionId)
    wrapper = ScriptWrapper(script)
    wrapper.add_log_handler()
    return wrapper
