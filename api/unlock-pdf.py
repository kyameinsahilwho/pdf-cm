import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _shared import BaseConversionHandler, load_engine

class handler(BaseConversionHandler):
    IN_SUFFIX        = ".pdf"
    OUT_SUFFIX       = ".pdf"
    OUT_CONTENT_TYPE = "application/pdf"
    OUT_FILE_EXT     = ".pdf"

    def do_convert(self, input_path, output_path, fields):
        password = fields.get('password', '')
        engine = load_engine()
        engine.unlock_pdf_file(input_path, output_path, password)
