#!/usr/bin/env python3
"""
One-time backfill: recompress historical base64 image fields in Firestore.

Usage:
  python3 scripts/backfill_image_compression.py               # dry run
  python3 scripts/backfill_image_compression.py --apply       # write updates
  python3 scripts/backfill_image_compression.py --apply --limit 500
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional

ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.db.firebase import get_firestore  # noqa: E402
from app.core.images import normalize_image_value  # noqa: E402


@dataclass
class FieldSpec:
    field: str
    field_label: str
    strict_data_url: bool
    max_data_url_length: int
    max_dimension: int
    jpeg_quality: int


def _is_data_image(v: Optional[str]) -> bool:
    if not isinstance(v, str):
        return False
    s = v.strip()
    return s.startswith("data:image/") and ";base64," in s


def _compress_with_spec(value: str, spec: FieldSpec) -> str:
    return normalize_image_value(
        value,
        field_label=spec.field_label,
        strict_data_url=spec.strict_data_url,
        max_data_url_length=spec.max_data_url_length,
        max_dimension=spec.max_dimension,
        jpeg_quality=spec.jpeg_quality,
    ) or value


def _scan_collection(
    db,
    *,
    label: str,
    collection_path: str,
    get_docs,
    spec: FieldSpec,
    apply: bool,
    limit: int,
) -> dict:
    scanned = 0
    candidates = 0
    updated = 0
    skipped = 0
    errors = 0
    before_total = 0
    after_total = 0

    docs_iter = get_docs(db)
    for doc in docs_iter:
        if limit and scanned >= limit:
            break
        scanned += 1
        data = doc.to_dict() or {}
        raw = data.get(spec.field)
        if not _is_data_image(raw):
            skipped += 1
            continue
        candidates += 1
        try:
            new_val = _compress_with_spec(raw, spec)
        except Exception:
            errors += 1
            continue
        if not isinstance(new_val, str) or new_val == raw:
            skipped += 1
            continue
        before_total += len(raw)
        after_total += len(new_val)
        if apply:
            doc.reference.update({spec.field: new_val})
        updated += 1

    print(
        f"[{label}] scanned={scanned} candidates={candidates} updated={updated} "
        f"skipped={skipped} errors={errors} bytes_saved={max(0, before_total - after_total)}"
    )
    return {
        "scanned": scanned,
        "candidates": candidates,
        "updated": updated,
        "skipped": skipped,
        "errors": errors,
        "before_total": before_total,
        "after_total": after_total,
    }


def _org_message_docs(db):
    return db.collection("messages").stream()


def _dm_message_docs(db):
    convs = db.collection("dm_conversations").stream()
    for conv in convs:
        msgs = conv.reference.collection("messages").stream()
        for m in msgs:
            yield m


def _run_one(
    db,
    *,
    label: str,
    collection_path: str,
    get_docs: Callable,
    spec: FieldSpec,
    apply: bool,
    limit: int,
) -> dict:
    print(f"\n== {label} ({collection_path}.{spec.field}) ==")
    return _scan_collection(
        db,
        label=label,
        collection_path=collection_path,
        get_docs=get_docs,
        spec=spec,
        apply=apply,
        limit=limit,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill historical image compression.")
    parser.add_argument("--apply", action="store_true", help="Write updates (default is dry run).")
    parser.add_argument("--limit", type=int, default=0, help="Optional per-scope doc limit (0 = no limit).")
    args = parser.parse_args()

    mode = "APPLY" if args.apply else "DRY RUN"
    print(f"Starting image compression backfill [{mode}] ...")
    db = get_firestore()

    specs = [
        (
            "Users avatars",
            "users",
            lambda db_: db_.collection("users").stream(),
            FieldSpec("avatar", "Avatar image", False, 420_000, 900, 72),
        ),
        (
            "Organizations logos",
            "organizations",
            lambda db_: db_.collection("organizations").stream(),
            FieldSpec("logo", "Logo image", False, 420_000, 1100, 72),
        ),
        (
            "Event covers",
            "events",
            lambda db_: db_.collection("events").stream(),
            FieldSpec("cover_image", "Event cover image", False, 520_000, 1400, 74),
        ),
        (
            "Chat message images",
            "messages",
            _org_message_docs,
            FieldSpec("image_data_url", "Image attachment", True, 700_000, 1280, 72),
        ),
        (
            "DM message images",
            "dm_conversations/*/messages",
            _dm_message_docs,
            FieldSpec("image_data_url", "Image attachment", True, 700_000, 1280, 72),
        ),
        (
            "Org document image content",
            "documents",
            lambda db_: db_.collection("documents").stream(),
            FieldSpec("content", "Document image", False, 720_000, 1400, 74),
        ),
        (
            "Member document image uploads",
            "member_documents",
            lambda db_: db_.collection("member_documents").stream(),
            FieldSpec("file_url", "Document image", False, 720_000, 1400, 74),
        ),
    ]

    totals = {
        "scanned": 0,
        "candidates": 0,
        "updated": 0,
        "skipped": 0,
        "errors": 0,
        "before_total": 0,
        "after_total": 0,
    }
    for label, path, getter, spec in specs:
        stats = _run_one(
            db,
            label=label,
            collection_path=path,
            get_docs=getter,
            spec=spec,
            apply=args.apply,
            limit=max(0, args.limit),
        )
        for k in totals:
            totals[k] += stats.get(k, 0)

    saved = max(0, totals["before_total"] - totals["after_total"])
    print("\n== Backfill totals ==")
    print(
        f"mode={mode} scanned={totals['scanned']} candidates={totals['candidates']} "
        f"updated={totals['updated']} skipped={totals['skipped']} errors={totals['errors']}"
    )
    print(f"bytes_saved={saved}")
    if not args.apply:
        print("Dry run complete. Re-run with --apply to write updates.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
