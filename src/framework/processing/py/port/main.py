from collections.abc import Generator
from port.script import process
from port.api.commands import CommandSystemExit


class ScriptWrapper(Generator):
    def __init__(self, script):
        self.script = script

    def send(self, data):
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
