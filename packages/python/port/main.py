from collections.abc import Generator
from port.script import process
from port.api.commands import CommandSystemExit
from port.api.file_utils import AsyncFileAdapter


class ScriptWrapper(Generator):
    def __init__(self, script):
        self.script = script

    def send(self, data):
        # Automatically wrap JS file readers with AsyncFileAdapter
        if data and getattr(data, '__type__') == "PayloadFile":
            data.value = AsyncFileAdapter(data.value)

        try:
            command = self.script.send(data)
        except StopIteration:
            return CommandSystemExit(0, "End of script").toDict()
        else:
            return command.toDict()

    def throw(self, type=None, value=None, traceback=None):
        raise StopIteration


def start(sessionId):
    script = process(sessionId)
    return ScriptWrapper(script)
