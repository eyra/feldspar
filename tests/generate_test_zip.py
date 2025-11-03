#!/usr/bin/env python3
"""
Generate a test ZIP file with specified size and number of files.

This script efficiently creates ZIP files without compression (ZIP_STORED)
and without using temporary files. Content is generated on-the-fly and
written directly to the ZIP archive.

Features:
- No compression (actual file size matches specified size)
- No temporary files (memory efficient)
- Fast generation (streaming content directly to ZIP)
- Configurable size and number of files

Usage:
    python generate_test_zip.py --size 1GB --files 10 --output test.zip
    python generate_test_zip.py -s 500MB -f 5 -o test_500mb.zip --force
"""

import argparse
import os
import zipfile
import io


def parse_size(size_str):
    """
    Parse size string like '1GB', '500MB', '10KB' into bytes.

    Args:
        size_str: String like '1GB', '500MB', etc.

    Returns:
        int: Size in bytes
    """
    size_str = size_str.upper().strip()

    # Extract number and unit - check longer units first
    units = [
        ('TB', 1024**4),
        ('GB', 1024**3),
        ('MB', 1024**2),
        ('KB', 1024),
        ('B', 1),
    ]

    for unit, multiplier in units:
        if size_str.endswith(unit):
            number = size_str[:-len(unit)].strip()
            try:
                return int(float(number) * multiplier)
            except ValueError:
                raise ValueError(f"Invalid size format: {size_str}")

    # If no unit specified, assume bytes
    try:
        return int(size_str)
    except ValueError:
        raise ValueError(f"Invalid size format: {size_str}")


def format_size(bytes_size):
    """Format bytes into human-readable string."""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if bytes_size < 1024.0:
            return f"{bytes_size:.2f} {unit}"
        bytes_size /= 1024.0
    return f"{bytes_size:.2f} PB"


def generate_file_content(size_bytes, chunk_size=8*1024*1024):
    """
    Generate file content of specified size as a generator.

    Args:
        size_bytes: Total size in bytes
        chunk_size: Size of each chunk to generate (default 8MB)

    Yields:
        bytes: Chunks of content
    """
    # Use a simple repeating pattern
    # Mix of text to make it somewhat realistic but not too compressible
    pattern = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789\n" * 100
    pattern_len = len(pattern)

    remaining = size_bytes
    while remaining > 0:
        chunk = min(chunk_size, remaining)
        # Repeat pattern to fill chunk
        full_chunks = chunk // pattern_len
        remainder = chunk % pattern_len

        yield pattern * full_chunks + pattern[:remainder]
        remaining -= chunk


class FileGenerator:
    """A file-like object that generates content on-the-fly."""

    def __init__(self, size_bytes):
        self.size = size_bytes
        self.position = 0
        self.generator = generate_file_content(size_bytes)
        self.current_chunk = b""
        self.chunk_offset = 0

    def read(self, size=-1):
        """Read up to size bytes."""
        if size == -1:
            size = self.size - self.position

        if size <= 0 or self.position >= self.size:
            return b""

        # Don't read past the end
        size = min(size, self.size - self.position)

        result = b""
        while len(result) < size:
            # Get more data if current chunk is exhausted
            if self.chunk_offset >= len(self.current_chunk):
                try:
                    self.current_chunk = next(self.generator)
                    self.chunk_offset = 0
                except StopIteration:
                    break

            # Take what we need from current chunk
            needed = size - len(result)
            available = len(self.current_chunk) - self.chunk_offset
            take = min(needed, available)

            result += self.current_chunk[self.chunk_offset:self.chunk_offset + take]
            self.chunk_offset += take

        self.position += len(result)
        return result


def generate_zip(output_path, target_size_bytes, num_files):
    """
    Generate a ZIP file with specified total size and number of files.

    Args:
        output_path: Path for output ZIP file
        target_size_bytes: Target total uncompressed size
        num_files: Number of files to include
    """
    print(f"\nGenerating ZIP file:")
    print(f"  Target size: {format_size(target_size_bytes)}")
    print(f"  Number of files: {num_files}")
    print(f"  Output: {output_path}")
    print(f"  Compression: STORED (no compression)")
    print()

    # Calculate size per file
    size_per_file = target_size_bytes // num_files
    remainder = target_size_bytes % num_files

    # Create ZIP file with no compression (ZIP_STORED)
    print("Creating ZIP archive...")
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_STORED) as zf:
        for i in range(num_files):
            # Add remainder bytes to last file
            file_size = size_per_file + (remainder if i == num_files - 1 else 0)

            # Generate filename with extension variety
            extensions = ['.txt', '.csv', '.json', '.log', '.dat']
            ext = extensions[i % len(extensions)]
            filename = f"test_file_{i+1:04d}{ext}"

            print(f"  Writing {filename} ({format_size(file_size)})...", end='', flush=True)

            # Create file-like object that generates content on-the-fly
            file_obj = FileGenerator(file_size)

            # Write directly to ZIP without creating temp file
            # Create ZipInfo for the file
            zinfo = zipfile.ZipInfo(filename=filename)
            zinfo.compress_type = zipfile.ZIP_STORED

            # Write the file content
            with zf.open(zinfo, 'w') as dest:
                while True:
                    chunk = file_obj.read(8 * 1024 * 1024)  # Read 8MB at a time
                    if not chunk:
                        break
                    dest.write(chunk)

            print(" ✓")

    # Get final sizes
    zip_size = os.path.getsize(output_path)

    # Calculate actual uncompressed size
    with zipfile.ZipFile(output_path, 'r') as zf:
        uncompressed_size = sum(info.file_size for info in zf.infolist())

    compression_ratio = (1 - zip_size / uncompressed_size) * 100 if uncompressed_size > 0 else 0

    print(f"\n✅ ZIP file created successfully!")
    print(f"\n📊 Statistics:")
    print(f"  Uncompressed size: {format_size(uncompressed_size)}")
    print(f"  Compressed size:   {format_size(zip_size)}")
    print(f"  Compression ratio: {compression_ratio:.1f}%")
    print(f"  Files in archive:  {num_files}")
    print(f"  Output location:   {os.path.abspath(output_path)}")


def main():
    parser = argparse.ArgumentParser(
        description='Generate a test ZIP file with specified size and number of files.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --size 1GB --files 10 --output test_1gb.zip
  %(prog)s -s 500MB -f 5 -o test_500mb.zip
  %(prog)s --size 100MB --files 100 --output many_files.zip --force
  %(prog)s --size 2GB --files 20 --output test_2gb.zip

Note:
  Files are created with ZIP_STORED (no compression) to ensure the
  actual file size matches the specified size.
        """
    )

    parser.add_argument(
        '-s', '--size',
        required=True,
        help='Target total uncompressed size (e.g., 1GB, 500MB, 10KB)'
    )

    parser.add_argument(
        '-f', '--files',
        type=int,
        required=True,
        help='Number of files to include in the ZIP'
    )

    parser.add_argument(
        '-o', '--output',
        default='test.zip',
        help='Output ZIP file path (default: test.zip)'
    )

    parser.add_argument(
        '--force',
        action='store_true',
        help='Overwrite output file without asking'
    )

    args = parser.parse_args()

    # Validate arguments
    if args.files <= 0:
        parser.error("Number of files must be positive")

    try:
        target_size = parse_size(args.size)
    except ValueError as e:
        parser.error(str(e))

    if target_size <= 0:
        parser.error("Size must be positive")

    # Check if output file already exists
    if os.path.exists(args.output) and not args.force:
        try:
            response = input(f"⚠️  File '{args.output}' already exists. Overwrite? (y/n): ")
            if response.lower() != 'y':
                print("Cancelled.")
                return
        except (EOFError, KeyboardInterrupt):
            print("\nCancelled.")
            return

    # Generate the ZIP file
    try:
        generate_zip(args.output, target_size, args.files)
    except KeyboardInterrupt:
        print("\n\n❌ Cancelled by user")
        if os.path.exists(args.output):
            os.remove(args.output)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        if os.path.exists(args.output):
            os.remove(args.output)
        raise


if __name__ == '__main__':
    main()
