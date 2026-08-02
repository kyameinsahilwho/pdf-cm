import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _shared import BaseConversionHandler, load_engine

class handler(BaseConversionHandler):
    IN_SUFFIX        = ".pdf"
    OUT_SUFFIX       = ".docx"
    OUT_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    OUT_FILE_EXT     = ".docx"

    def do_convert(self, input_path, output_path, fields):
        engine = load_engine()
        engine.convert_pdf_to_word(input_path, output_path)
