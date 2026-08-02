"""
_shared.py — Base handler & utilities shared by all Vercel Python Serverless Functions.
Each api/[endpoint].py imports from here.
"""
import sys
import os
import re
import json
import tempfile
import traceback
from http.server import BaseHTTPRequestHandler
import importlib.util

# Ensure the api/ directory is on the Python path so sibling modules are importable
API_DIR = os.path.dirname(os.path.abspath(__file__))
if API_DIR not in sys.path:
    sys.path.insert(0, API_DIR)


# ---------------------------------------------------------------------------
# Multipart form-data parser (no deprecated `cgi` module)
# ---------------------------------------------------------------------------

def parse_multipart(data: bytes, boundary: str) -> tuple:
    """Parse multipart/form-data body.  Returns (files, fields) dicts."""
    if isinstance(boundary, str):
        boundary = boundary.encode('utf-8')

    files: dict = {}   # name -> (filename: str, body: bytes)
    fields: dict = {}  # name -> str

    parts = data.split(b'--' + boundary)
    for part in parts:
        if not part or part.strip() in (b'', b'--', b'--\r\n'):
            continue
        sep = part.find(b'\r\n\r\n')
        if sep == -1:
            continue
        hdr_raw = part[:sep].decode('utf-8', errors='ignore')
        body = part[sep + 4:]
        if body.endswith(b'\r\n'):
            body = body[:-2]

        nm = re.search(r'name="([^"]+)"', hdr_raw)
        if not nm:
            continue
        name = nm.group(1)

        fn = re.search(r'filename="([^"]+)"', hdr_raw)
        if fn:
            files[name] = (fn.group(1), body)
        else:
            fields[name] = body.decode('utf-8', errors='ignore')

    return files, fields


# ---------------------------------------------------------------------------
# Lazy engine loaders (avoid importing heavy libs at module-load time)
# ---------------------------------------------------------------------------

def load_engine():
    """Load convert-office-pdf.py as a module (filename has hyphens so use importlib)."""
    path = os.path.join(API_DIR, 'convert-office-pdf.py')
    spec = importlib.util.spec_from_file_location('convert_office_pdf', path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def load_word_engine():
    """Load convert-word-to-pdf.py as a module."""
    path = os.path.join(API_DIR, 'convert-word-to-pdf.py')
    spec = importlib.util.spec_from_file_location('convert_word_to_pdf', path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ---------------------------------------------------------------------------
# Base Vercel handler
# ---------------------------------------------------------------------------

class BaseConversionHandler(BaseHTTPRequestHandler):
    """
    Sub-class this and override:
      IN_SUFFIX         — extension for the temp input file  (e.g. '.pdf')
      OUT_SUFFIX        — extension for the temp output file (e.g. '.docx')
      OUT_CONTENT_TYPE  — MIME type for the response
      OUT_FILE_EXT      — download filename extension        (e.g. '.docx')
      do_convert(in_path, out_path, fields)  — actual conversion logic
    """

    IN_SUFFIX        = ".pdf"
    OUT_SUFFIX       = ".out"
    OUT_CONTENT_TYPE = "application/octet-stream"
    OUT_FILE_EXT     = ".out"

    # ---- request routing --------------------------------------------------

    def do_GET(self):
        self._json(200, {"status": "ready", "handler": self.__class__.__name__})

    def do_POST(self):
        tmp_in = tmp_out = ""
        try:
            length = int(self.headers.get('Content-Length', 0))
            ctype  = self.headers.get('Content-Type', '')
            body   = self.rfile.read(length)

            files, fields = {}, {}
            if 'multipart/form-data' in ctype and 'boundary=' in ctype:
                boundary = ctype.split('boundary=')[1].split(';')[0].strip('"')
                files, fields = parse_multipart(body, boundary)

            if 'file' not in files:
                self._json(400, {"error": "No file provided in multipart/form-data"})
                return

            filename, file_bytes = files['file']

            # Write input to a temp file
            with tempfile.NamedTemporaryFile(delete=False, suffix=self.IN_SUFFIX) as f:
                f.write(file_bytes)
                tmp_in = f.name

            tmp_out = tmp_in + self.OUT_SUFFIX

            # Delegate conversion
            self.do_convert(tmp_in, tmp_out, fields)

            with open(tmp_out, 'rb') as f:
                out_bytes = f.read()

            stem = os.path.splitext(filename)[0]
            dl_name = f"{stem}{self.OUT_FILE_EXT}"

            self.send_response(200)
            self.send_header('Content-Type', self.OUT_CONTENT_TYPE)
            self.send_header('Content-Length', str(len(out_bytes)))
            self.send_header('Content-Disposition', f'attachment; filename="{dl_name}"')
            self.end_headers()
            self.wfile.write(out_bytes)

        except Exception as exc:
            traceback.print_exc()
            self._json(500, {"error": str(exc)})
        finally:
            for p in (tmp_in, tmp_out):
                try:
                    if p and os.path.exists(p):
                        os.remove(p)
                except Exception:
                    pass

    # ---- to be overridden -------------------------------------------------

    def do_convert(self, input_path: str, output_path: str, fields: dict):
        raise NotImplementedError("do_convert() must be implemented by each handler")

    # ---- helpers ----------------------------------------------------------

    def _json(self, code: int, payload: dict):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        pass  # suppress default HTTP server logging
