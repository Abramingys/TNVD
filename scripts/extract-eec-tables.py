"""Export candidate rows for review. This output is not an import snapshot."""

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

import pymupdf


def clean(cell):
    return " ".join((cell or "").split())


def extract(path):
    with pymupdf.open(path) as document:
        previous = None
        for page in document:
            for table in page.find_tables().tables:
                cells = table.header.cells
                if len(cells) != 4 or any(cell is None for cell in cells):
                    continue
                if "Наименование" not in clean(table.header.names[1]):
                    continue
                lines = []
                words = sorted(page.get_text("words", clip=table.bbox), key=lambda word: (word[1], word[0]))
                for word in words:
                    if word[1] < table.header.bbox[3] - 1 or word[0] >= cells[2][0]:
                        continue
                    if not lines or word[1] - lines[-1][0][1] > 3:
                        lines.append([])
                    lines[-1].append(word)
                for line in lines:
                    line.sort(key=lambda word: word[0])
                    code = "".join(word[4] for word in line if word[0] < cells[1][0])
                    title = " ".join(word[4] for word in line if word[0] >= cells[1][0])
                    if re.fullmatch(r"[0-9]{4,10}", code) or (not code and re.match(r"^[-–—]\s", title)):
                        if previous:
                            yield previous
                        previous = {"page": page.number + 1, "code": code or None, "title": title}
                    elif previous and not code and title:
                        previous["title"] += " " + title
        if previous:
            yield previous


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--group", help="Limit the review to a two-digit group.")
    parser.add_argument("--output", type=Path, help="Write the review JSON to a new file.")
    args = parser.parse_args()
    manifest = json.loads((args.directory / "manifest.json").read_text(encoding="utf-8-sig"))
    result = []
    warnings = []
    for entry in manifest:
        group = entry["group"]
        if args.group and args.group != group:
            continue
        if not re.fullmatch(r"[0-9]{2}", group) or entry["file"] != group + ".pdf":
            raise ValueError("Unexpected manifest entry")
        path = args.directory / entry["file"]
        if hashlib.sha256(path.read_bytes()).hexdigest() != entry["sha256"]:
            raise ValueError(f"Checksum mismatch for group {group}")
        rows = list(extract(path))
        if not rows:
            warnings.append(f"Group {group}: no rows extracted")
        if any(row["code"] and not row["code"].startswith(group) for row in rows):
            warnings.append(f"Group {group}: unexpected code prefix")
        if any(not row["title"] for row in rows):
            warnings.append(f"Group {group}: empty extracted title")
        result.append({"group": group, "source": entry["source"], "rows": rows})
    if not result:
        raise ValueError("No matching groups")
    payload = {"status": "review_required", "warnings": warnings, "groups": result}
    if args.output:
        with args.output.open("x", encoding="utf-8") as stream:
            json.dump(payload, stream, ensure_ascii=False, indent=2)
        print(f"{len(result)} groups, {sum(len(group['rows']) for group in result)} rows, {len(warnings)} warnings")
    else:
        sys.stdout.reconfigure(encoding="utf-8")
        print(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    main()
