import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _shared import BaseConversionHandler, load_engine

class handler(BaseConversionHandler):
    IN_SUFFIX        = ".pptx"
    OUT_SUFFIX       = ".pdf"
    OUT_CONTENT_TYPE = "application/pdf"
    OUT_FILE_EXT     = ".pdf"

    def do_convert(self, input_path, output_path, fields):
        # Detect original extension from the uploaded filename if possible
        engine = load_engine()
        engine.convert_ppt_to_pdf(input_path, output_path)
