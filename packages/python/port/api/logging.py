import logging
from port.api.commands import CommandSystemLog


class LogForwardingHandler(logging.Handler):
    """Logging handler that queues records as CommandSystemLog commands for the script wrapper."""

    _LEVEL_MAP = {
        logging.DEBUG: "debug",
        logging.INFO: "info",
        logging.WARNING: "warn",
        logging.ERROR: "error",
        logging.CRITICAL: "error",
    }

    def __init__(self, queue):
        super().__init__()
        self._queue = queue

    def emit(self, record):
        level = self._LEVEL_MAP.get(record.levelno, "info")
        self._queue.append(CommandSystemLog(level=level, message=self.format(record)).toDict())
