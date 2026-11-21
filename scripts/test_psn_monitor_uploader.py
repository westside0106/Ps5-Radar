"""Tests for the standalone Ubuntu uploader (no network, no real secrets)."""
import csv
import importlib.util
import io
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SOURCE = Path(__file__).with_name("push-psn-monitor.py")
SPEC = importlib.util.spec_from_file_location("psn_monitor_uploader", SOURCE)
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)

class MonitorUploaderTest(unittest.TestCase):
    def test_csv_tail_preserves_real_quote_rules(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "changes.csv"
            with path.open("w", encoding="utf-8", newline="") as handle:
                writer = csv.writer(handle)
                writer.writerow(module.HEADER)
                for i in range(1830):
                    writer.writerow([f"2026-11-20 12:{i%60:02}:00", "online", f'Game, "Edition" {i}'])
            payload, count = module.build_payload(path)
            self.assertEqual(count, module.MAX_ROWS)
            rows = list(csv.reader(io.StringIO(payload.decode("utf-8"))))
            self.assertEqual(rows[0], module.HEADER)
            self.assertEqual(len(rows), module.MAX_ROWS + 1)
            self.assertEqual(rows[1][2], 'Game, "Edition" 30')
            self.assertEqual(rows[-1][2], 'Game, "Edition" 1829')

    def test_reject_wrong_header(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "wrong.csv"
            path.write_text("Date,Game,Secret\n2026-11-20,Game,secret\n", encoding="utf8")
            with self.assertRaisesRegex(ValueError, "header"):
                module.build_payload(path)

    def test_missing_secret_or_insecure_endpoint_fails(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "exists.csv"
            path.write_text("Date,Status,Game name\n", encoding="utf8")
            good = {
                "PSN_MONITOR_CSV_PATH": str(path),
                "PSN_MONITOR_PUSH_TOKEN": "a" * 64,
                "PSN_MONITOR_SYNC_URL": "https://playstation-radar-private.vercel.app/mein-playstation/api/monitor-sync",
            }
            with patch.dict(os.environ, good, clear=True):
                self.assertEqual(module.validate_env()[0], path)
            with patch.dict(os.environ, {**good, "PSN_MONITOR_PUSH_TOKEN": "short"}, clear=True):
                with self.assertRaisesRegex(ValueError, "TOKEN"):
                    module.validate_env()
            with patch.dict(os.environ, {**good, "PSN_MONITOR_SYNC_URL": "http://example.com/mein-playstation/api/monitor-sync"}, clear=True):
                with self.assertRaisesRegex(ValueError, "HTTPS"):
                    module.validate_env()
            with patch.dict(os.environ, {**good, "PSN_MONITOR_SYNC_URL": "https://example.com/mein-playstation/api/monitor-sync?key=secret"}, clear=True):
                with self.assertRaisesRegex(ValueError, "HTTPS"):
                    module.validate_env()

    def test_http_redirects_never_carry_machine_auth(self):
        handler = module.NoRedirects()
        self.assertIsNone(handler.redirect_request(None, None, 302, "redirect", {}, "https://other.test"))
if __name__ == "__main__":
    unittest.main()
