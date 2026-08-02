import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _shared import BaseConversionHandler, load_engine

class handler(BaseConversionHandler):
    IN_SUFFIX        = ".html"
    OUT_SUFFIX       = ".pdf"
    OUT_CONTENT_TYPE = "application/pdf"
    OUT_FILE_EXT     = ".pdf"

    def do_POST(self):
        """Override to accept raw text/html body in addition to multipart."""
        import tempfile, json, traceback

        tmp_in = tmp_out = ""
        try:
            length = int(self.headers.get('Content-Length', 0))
            ctype  = self.headers.get('Content-Type', '')
            body   = self.rfile.read(length)

            if 'multipart/form-data' in ctype:
                from _shared import parse_multipart
                boundary = ctype.split('boundary=')[1].split(';')[0].strip('"')
                files, fields = parse_multipart(body, boundary)
                if 'html' in files:
                    _, html_bytes = files['html']
                elif 'file' in files:
                    _, html_bytes = files['file']
                else:
                    html_bytes = body
            else:
                # Accept raw HTML body (text/html or application/x-www-form-urlencoded)
                html_bytes = body

            with tempfile.NamedTemporaryFile(delete=False, suffix='.html', mode='wb') as f:
                f.write(html_bytes)
                tmp_in = f.name

            tmp_out = tmp_in + '.pdf'

            engine = load_engine()
            engine.convert_html_to_pdf(tmp_in, tmp_out)

            with open(tmp_out, 'rb') as f:
                out_bytes = f.read()

            self.send_response(200)
            self.send_header('Content-Type', 'application/pdf')
            self.send_header('Content-Length', str(len(out_bytes)))
            self.send_header('Content-Disposition', 'attachment; filename="converted.pdf"')
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

    def do_convert(self, input_path, output_path, fields):
        engine = load_engine()
        engine.convert_html_to_pdf(input_path, output_path)
