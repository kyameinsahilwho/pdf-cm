import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _shared import BaseConversionHandler, load_word_engine

class handler(BaseConversionHandler):
    IN_SUFFIX        = ".docx"
    OUT_SUFFIX       = ".pdf"
    OUT_CONTENT_TYPE = "application/pdf"
    OUT_FILE_EXT     = ".pdf"

    def do_convert(self, input_path, output_path, fields):
        # On Vercel, docx2pdf (native MS Word / LibreOffice) is unavailable.
        # The engine automatically falls back to the ReportLab pure-Python renderer.
        engine = load_word_engine()
        engine.convert_word_to_pdf(input_path, output_path)
