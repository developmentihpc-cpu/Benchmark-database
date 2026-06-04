#!/usr/bin/env python3
"""Minimal static dev server for Benchmark DB.

Serves the project directory with caching disabled (so edits show up on
reload) and opens the page in your browser.

    python serve.py            # serves on http://localhost:8000
    python serve.py 9000       # custom port
"""
import http.server
import socketserver
import sys
import webbrowser
from functools import partial
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = Path(__file__).resolve().parent


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Keep the console quiet apart from real errors.
        if not str(args[1] if len(args) > 1 else "").startswith("2"):
            super().log_message(fmt, *args)


def main():
    handler = partial(NoCacheHandler, directory=str(ROOT))
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        url = f"http://localhost:{PORT}/"
        print(f"Benchmark DB serving {ROOT}")
        print(f"  -> {url}  (Ctrl+C to stop)")
        try:
            webbrowser.open(url)
        except Exception:
            pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()
