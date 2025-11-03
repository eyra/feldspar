"""
File utilities for handling browser File API with synchronous Python I/O.

This module provides adapters to bridge async browser File APIs with
synchronous Python file operations, avoiding the need to copy entire
files into Pyodide's virtual filesystem.
"""

import js


class AsyncFileAdapter:
    """
    A file-like object that reads from browser File API on-demand.

    This adapter wraps a JavaScript file reader object and provides
    a synchronous file-like interface for Python code. Data is read
    in chunks only when needed, avoiding memory copies.

    Args:
        js_reader: JavaScript file reader object with readSlice, size, and name
    """

    def __init__(self, js_reader):
        # Store the JS reader object directly (via Pyodide FFI)
        self.reader = js_reader
        self.position = 0
        self.size = self.reader.size
        self.name = self.reader.name
        self._closed = False

    def read(self, size=-1):
        """
        Read and return up to size bytes.

        Args:
            size: Number of bytes to read. If -1, read until EOF.

        Returns:
            bytes: The data read from the file.
        """
        if self._closed:
            raise ValueError("I/O operation on closed file")

        if size == -1:
            size = self.size - self.position

        if size <= 0:
            return b""

        # Ensure we don't read past the end
        size = min(size, self.size - self.position)

        # Call the synchronous JS function (uses FileReaderSync in worker)
        chunk_data = self.reader.readSlice(self.position, self.position + size)

        # Convert to Python bytes
        result = bytes(chunk_data.to_py())
        self.position += len(result)

        return result

    def seek(self, offset, whence=0):
        """
        Change stream position.

        Args:
            offset: Position offset
            whence: How to interpret offset:
                    0 = absolute position
                    1 = relative to current position
                    2 = relative to end of file

        Returns:
            int: The new absolute position
        """
        if self._closed:
            raise ValueError("I/O operation on closed file")

        if whence == 0:  # absolute position
            new_pos = offset
        elif whence == 1:  # relative to current
            new_pos = self.position + offset
        elif whence == 2:  # relative to end
            new_pos = self.size + offset
        else:
            raise ValueError(f"Invalid whence value: {whence}")

        # Clamp to valid range
        self.position = max(0, min(new_pos, self.size))
        return self.position

    def tell(self):
        """Return current stream position."""
        if self._closed:
            raise ValueError("I/O operation on closed file")
        return self.position

    def close(self):
        """Close the file and clean up resources."""
        if not self._closed:
            self._closed = True
            # JS object cleanup is handled by Pyodide's garbage collection

    def __enter__(self):
        """Support for context manager protocol."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Support for context manager protocol."""
        self.close()
        return False

    def readable(self):
        """Return whether the file is readable."""
        return not self._closed

    def seekable(self):
        """Return whether the file supports seeking."""
        return not self._closed

    def writable(self):
        """Return whether the file is writable (always False)."""
        return False
