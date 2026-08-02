import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _shared import BaseConversionHandler, load_engine

class handler(BaseConversionHandler):
    IN_SUFFIX        = ".pdf"
    OUT_SUFFIX       = ".md"
    OUT_CONTENT_TYPE = "text/markdown; charset=utf-8"
    OUT_FILE_EXT     = ".md"

    def do_convert(self, input_path, output_path, fields):
        engine = load_engine()
        engine.convert_pdf_to_markdown(input_path, output_path)
