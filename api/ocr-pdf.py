import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _shared import BaseConversionHandler, load_engine

class handler(BaseConversionHandler):
    IN_SUFFIX        = ".pdf"
    OUT_SUFFIX       = ".pdf"
    OUT_CONTENT_TYPE = "application/pdf"
    OUT_FILE_EXT     = ".pdf"

    def do_convert(self, input_path, output_path, fields):
        engine = load_engine()
        # OCR requires tesseract binary — on Vercel this gracefully falls through
        # to the pypdf text-layer copy path inside perform_ocr_pdf()
        engine.perform_ocr_pdf(input_path, output_path)
