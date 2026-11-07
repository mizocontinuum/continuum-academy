#!/usr/bin/env python3
"""Dev static server used by the "Run and Debug" launch configurations.

python's built-in http.server has no HTTP Range support, which breaks seeking
in the <video> element once clips live in Home/videos/. This handler adds it,
serves the project root, and prints a single "Ready:" line that the VS Code
background task matcher waits for before opening the browser.
"""

import mimetypes
import os
import socket
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

# .vscode/serve.py -> project root (so /Home/home.html resolves correctly)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_PORT = 8080
CHUNK = 64 * 1024

# Applied to every response so the dev server behaves like the host will.
# 'unsafe-inline' for script and style is a temporary allowance: the pages still
# carry inline onerror= attributes and the root redirect is an inline script.
# Remove it once those move into assets/js.
CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: blob:; "
    "media-src 'self' blob:; "
    "font-src 'self' data:; "
    "connect-src 'self'; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "form-action 'self'"
)

SECURITY_HEADERS = (
    ("Content-Security-Policy", CSP),
    ("X-Content-Type-Options", "nosniff"),
    ("X-Frame-Options", "DENY"),
    ("Referrer-Policy", "strict-origin-when-cross-origin"),
    ("Permissions-Policy", "geolocation=(), camera=(), microphone=()"),
    ("Cross-Origin-Opener-Policy", "same-origin"),
)


class RangeRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-store")
        for name, value in SECURITY_HEADERS:
            self.send_header(name, value)
        super().end_headers()

    def send_head(self):
        header = self.headers.get("Range")
        if not header or not header.startswith("bytes="):
            return super().send_head()

        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()

        try:
            handle = open(path, "rb")
        except OSError:
            self.send_error(404, "File not found")
            return None

        size = os.fstat(handle.fileno()).st_size
        try:
            start_raw, end_raw = header[len("bytes="):].split("-", 1)
            if start_raw == "":
                start = max(0, size - int(end_raw))
                end = size - 1
            else:
                start = int(start_raw)
                end = int(end_raw) if end_raw else size - 1
        except ValueError:
            handle.close()
            self.send_error(400, "Malformed Range header")
            return None

        if start >= size or start > end:
            handle.close()
            self.send_response(416)
            self.send_header("Content-Range", "bytes */%d" % size)
            self.end_headers()
            return None

        end = min(end, size - 1)
        self._range_remaining = end - start + 1
        self.send_response(206)
        self.send_header("Content-Type", self.content_type_for(path))
        self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        self.send_header("Content-Length", str(self._range_remaining))
        self.end_headers()
        handle.seek(start)
        return handle

    def copyfile(self, source, outputfile):
        remaining = getattr(self, "_range_remaining", None)
        if remaining is None:
            return super().copyfile(source, outputfile)
        try:
            while remaining > 0:
                chunk = source.read(min(CHUNK, remaining))
                if not chunk:
                    break
                outputfile.write(chunk)
                remaining -= len(chunk)
        finally:
            self._range_remaining = None

    def content_type_for(self, path):
        guessed, _ = mimetypes.guess_type(path)
        return guessed or "application/octet-stream"


def port_is_serving(port):
    """True only if something answers an HTTP request on the port."""
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=1.5) as sock:
            sock.sendall(b"HEAD / HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n")
            return bool(sock.recv(16))
    except OSError:
        return False


def lan_address():
    """Best-effort LAN IP, so a phone on the same Wi-Fi knows where to point."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            # No packet is sent: connect() only picks the outbound interface.
            sock.connect(("8.8.8.8", 80))
            return sock.getsockname()[0]
    except OSError:
        return None


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PORT

    try:
        # 0.0.0.0 rather than 127.0.0.1: a phone on the same network needs to reach it
        server = ThreadingHTTPServer(("0.0.0.0", port), RangeRequestHandler)
    except OSError:
        if port_is_serving(port):
            print("Ready: http://127.0.0.1:%d/ is already served by another process"
                  % port, flush=True)
            return 0
        print("ERROR: port %d is held by a process that does not answer HTTP." % port,
              flush=True)
        print("       It accepts connections but sends nothing, which shows up in the",
              flush=True)
        print("       browser as ERR_EMPTY_RESPONSE. Stop it, then debug again:", flush=True)
        print("       lsof -nP -iTCP:%d -sTCP:LISTEN" % port, flush=True)
        return 1

    print("Ready: http://127.0.0.1:%d/ (serving %s)" % (port, ROOT), flush=True)
    lan = lan_address()
    if lan:
        print("       Phone on the same Wi-Fi: http://%s:%d/" % (lan, port), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
