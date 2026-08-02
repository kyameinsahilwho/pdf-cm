import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _shared import BaseConversionHandler, load_engine

class handler(BaseConversionHandler):
    IN_SUFFIX        = ".xlsx"
    OUT_SUFFIX       = ".pdf"
    OUT_CONTENT_TYPE = "application/pdf"
    OUT_FILE_EXT     = ".pdf"

    def do_convert(self, input_path, output_path, fields):
        engine = load_engine()
        engine.convert_excel_to_pdf(input_path, output_path)
