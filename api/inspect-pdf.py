import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _shared import BaseConversionHandler, load_engine

class handler(BaseConversionHandler):
    IN_SUFFIX        = ".pdf"
    OUT_SUFFIX       = ".json"
    OUT_CONTENT_TYPE = "application/json"
    OUT_FILE_EXT     = ".json"

    def do_convert(self, input_path, output_path, fields):
        page = int(fields.get('page', '1'))
        engine = load_engine()
        engine.inspect_pdf_page_elements(input_path, page, output_path)
