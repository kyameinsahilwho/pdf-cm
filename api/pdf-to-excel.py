import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _shared import BaseConversionHandler, load_engine

class handler(BaseConversionHandler):
    IN_SUFFIX        = ".pdf"
    OUT_SUFFIX       = ".xlsx"
    OUT_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    OUT_FILE_EXT     = ".xlsx"

    def do_convert(self, input_path, output_path, fields):
        engine = load_engine()
        engine.convert_pdf_to_excel(input_path, output_path)
