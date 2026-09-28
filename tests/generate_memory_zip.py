#!/usr/bin/env python3
"""Generate large donated values for the unmodified Feldspar demo script."""

import argparse
import json
from pathlib import Path
import zipfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--mib", type=int, default=192, help="Total synthetic User text in MiB")
    parser.add_argument("--files", type=int, default=256)
    args = parser.parse_args()
    total = args.mib * 1024 * 1024
    if args.mib < 1 or not 1 <= args.files <= 10000 or total // args.files < 64:
        parser.error("Use positive MiB, 1–10000 files, and at least 64 bytes per file")

    metadata = {"format": "feldspar-demo-memory-1", "text_bytes": total, "files": args.files}
    # Exclusive creation avoids accidentally replacing an existing export.
    with zipfile.ZipFile(args.output, "x", zipfile.ZIP_DEFLATED) as archive:
        archive.comment = json.dumps(metadata).encode("ascii")
        for index in range(args.files):
            size = total // args.files + (total % args.files if index == args.files - 1 else 0)
            prefix = f"SYNTHETIC MEMORY FIXTURE {index:06d}: "
            name = prefix + "x" * (size - len(prefix))
            document = {"user": {"name": name, "id": index}, "items": []}
            archive.writestr(f"profile_{index:06d}.json", json.dumps(document, separators=(",", ":")))
    print(json.dumps({**metadata, "zip_bytes": args.output.stat().st_size, "path": str(args.output)}))


if __name__ == "__main__":
    main()
