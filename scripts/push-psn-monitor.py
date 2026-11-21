#!/usr/bin/env python3
"""One-shot server push for a locally running psn_monitor CSV.

No PSN login, no access to the original monitor process and no stored tokens.
Put secrets in a root-readable systemd EnvironmentFile, never in Git.
"""
import csv
import io
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import deque
from pathlib import Path

HEADER = ["Date", "Status", "Game name"]
MAX_ROWS = 1800
MAX_UPLOAD_BYTES = 1_900_000
API_PATH = "/mein-playstation/api/monitor-sync"

class NoRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Never forward a machine-to-machine Authorization header on redirect.
        return None

def build_payload(path: Path):
    if not path.is_file():
        raise ValueError("PSN_MONITOR_CSV_PATH is not a regular, readable file")
    events = deque(maxlen=MAX_ROWS)
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != HEADER:
            raise ValueError("CSV header must be: Date, Status, Game name")
        for row in reader:
            if None in row or any(row.get(k) is None for k in HEADER):
                continue
            events.append([row[k] for k in HEADER])
    out = io.StringIO(newline="")
    writer = csv.writer(out, lineterminator="\n")
    writer.writerow(HEADER)
    writer.writerows(events)
    payload = out.getvalue().encode("utf-8")
    if len(payload) > MAX_UPLOAD_BYTES:
        raise ValueError("Recent CSV rows exceed the 1.9 MB safe upload limit")
    return payload, len(events)

def validate_env():
    source = os.environ.get("PSN_MONITOR_CSV_PATH", "")
    secret = os.environ.get("PSN_MONITOR_PUSH_TOKEN", "")
    url = os.environ.get("PSN_MONITOR_SYNC_URL",
        "https://playstation-radar-private.vercel.app" + API_PATH)
    if not source or not os.path.isabs(source):
        raise ValueError("PSN_MONITOR_CSV_PATH must be an absolute CSV file path")
    if not re.fullmatch(r"[A-Fa-f0-9]{64,128}", secret):
        raise ValueError("PSN_MONITOR_PUSH_TOKEN must be a 64-128 digit hexadecimal secret")
    parsed = urllib.parse.urlparse(url)
    if (parsed.scheme != "https" or not parsed.hostname or parsed.username or
            parsed.password or parsed.port or parsed.path != API_PATH or
            parsed.query or parsed.fragment):
        raise ValueError("PSN_MONITOR_SYNC_URL must be an HTTPS Radar monitor endpoint")
    return Path(source), secret, url

def main():
    try:
        path, secret, url = validate_env()
        payload, row_count = build_payload(path)
        if "--dry-run" in sys.argv:
            print(f"CSV valid: {row_count} recent rows, {len(payload)} upload bytes; no data sent")
            return 0
        request = urllib.request.Request(
            url,
            data=payload,
            headers={
                "Authorization": "Bearer " + secret,
                "Content-Type": "text/csv; charset=utf-8",
                "Accept": "application/json",
                "User-Agent": "PS5-Radar-Monitor-Push/1.0",
            },
            method="POST",
        )
        opener = urllib.request.build_opener(NoRedirects())
        with opener.open(request, timeout=25) as response:
            result = json.loads(response.read(8192))
        if result.get("ok") is not True:
            raise ValueError("Server returned an unexpected response")
        print("Monitor sync OK: "
              f"rows={row_count}, added={int(result.get('added',0))}, "
              f"total={int(result.get('total',0))}")
        return 0
    except urllib.error.HTTPError as exc:
        # Do not print response body or authentication headers.
        print(f"Monitor sync failed: HTTP {exc.code}", file=sys.stderr)
    except urllib.error.URLError:
        print("Monitor sync failed: network/TLS error", file=sys.stderr)
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print("Monitor sync failed: " + str(exc), file=sys.stderr)
    return 1

if __name__ == "__main__":
    raise SystemExit(main())
