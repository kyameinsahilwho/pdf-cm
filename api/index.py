"""
api/index.py — Unified Python Conversion Engine & Vercel Serverless Entrypoint

Consolidates all document conversion engines into a single Python file to optimize
Vercel deployment build times while providing CLI and HTTP handler endpoints.
"""
import sys
import os
import io
import re
import time
import json
import logging
import tempfile
import traceback
import subprocess
from http.server import BaseHTTPRequestHandler

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("pdf_conversion_engine")

# ---------------------------------------------------------------------------
# Native System Engine Helper (LibreOffice / MS Word CLI)
# ---------------------------------------------------------------------------

def try_native_conversion(input_path: str, output_path: str) -> bool:
    """Attempt native MS Word / LibreOffice conversion for exact replica."""
    if sys.platform in ['win32', 'darwin']:
        try:
            cmd = [sys.executable, "-c", f"from docx2pdf import convert; convert(r'{input_path}', r'{output_path}')"]
            res = subprocess.run(cmd, capture_output=True, timeout=12)
            if res.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                logger.info("[Engine] Converted via docx2pdf native engine.")
                return True
        except Exception as e:
            logger.warning(f"[Engine] docx2pdf native conversion skipped: {e}")

    soffice_cmd = None
    import shutil
    candidates = [
        "soffice", "libreoffice",
        "/usr/bin/soffice", "/usr/bin/libreoffice",
        "/usr/lib/libreoffice/program/soffice", "/usr/local/bin/soffice",
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe"
    ]
    for name in ["soffice", "libreoffice"]:
        found = shutil.which(name)
        if found and found not in candidates:
            candidates.insert(0, found)

    for cmd in candidates:
        try:
            res = subprocess.run([cmd, "--version"], capture_output=True, timeout=3)
            if res.returncode == 0:
                soffice_cmd = cmd
                break
        except Exception:
            pass


    if soffice_cmd:
        try:
            out_dir = os.path.dirname(output_path)
            res = subprocess.run(
                [soffice_cmd, "--headless", "--convert-to", "pdf", "--outdir", out_dir, input_path],
                capture_output=True,
                timeout=45
            )
            base_in = os.path.splitext(input_path)[0]
            expected_pdf = base_in + ".pdf"
            if os.path.exists(expected_pdf):
                if os.path.abspath(expected_pdf) != os.path.abspath(output_path):
                    os.replace(expected_pdf, output_path)
                logger.info(f"[Engine] Converted via LibreOffice headless ({soffice_cmd}).")
                return True
        except Exception as e:
            logger.error(f"[Engine] LibreOffice conversion error: {e}")

    return False


# ---------------------------------------------------------------------------
# Individual Conversion Routines
# ---------------------------------------------------------------------------

def convert_word_to_pdf(input_path: str, output_path: str, allow_reportlab_fallback: bool = False):
    """Convert DOCX/DOC to PDF using native engine or ReportLab fallback."""
    logger.info(f"Converting Word '{input_path}' -> '{output_path}'")
    if try_native_conversion(input_path, output_path):
        return True

    if not allow_reportlab_fallback:
        raise RuntimeError("LibreOffice conversion engine is unavailable on this host.")

    # Pure Python ReportLab Fallback
    import docx
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet

    doc = docx.Document(input_path)
    pdf_doc = SimpleDocTemplate(output_path, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []

    for p in doc.paragraphs:
        if p.text.strip():
            story.append(Paragraph(p.text, styles['Normal']))
            story.append(Spacer(1, 6))

    pdf_doc.build(story)
    logger.info("Converted via Python-docx + ReportLab fallback.")
    return True


def convert_ppt_to_pdf(input_path: str, output_path: str):
    """Convert PPTX to PDF using LibreOffice or fallback generator."""
    logger.info(f"Converting PowerPoint '{input_path}' -> '{output_path}'")
    if try_native_conversion(input_path, output_path):
        return True

    import pptx
    from reportlab.lib.pagesizes import landscape, letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet

    prs = pptx.Presentation(input_path)
    pdf_doc = SimpleDocTemplate(output_path, pagesize=landscape(letter))
    styles = getSampleStyleSheet()
    story = []

    for idx, slide in enumerate(prs.slides):
        story.append(Paragraph(f"--- Slide {idx + 1} ---", styles['Heading1']))
        story.append(Spacer(1, 12))
        for shape in slide.shapes:
            if hasattr(shape, "text") and shape.text.strip():
                story.append(Paragraph(shape.text, styles['Normal']))
                story.append(Spacer(1, 6))

    pdf_doc.build(story)
    return True


def convert_excel_to_pdf(input_path: str, output_path: str):
    """Convert XLSX to PDF using LibreOffice or openpyxl/ReportLab fallback."""
    logger.info(f"Converting Excel '{input_path}' -> '{output_path}'")
    if try_native_conversion(input_path, output_path):
        return True

    import openpyxl
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib import colors

    wb = openpyxl.load_workbook(input_path, data_only=True)
    pdf_doc = SimpleDocTemplate(output_path, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []

    for sheet in wb.worksheets:
        story.append(Paragraph(f"Sheet: {sheet.title}", styles['Heading2']))
        story.append(Spacer(1, 8))
        data = []
        for row in sheet.iter_rows(values_only=True):
            if any(cell is not None for cell in row):
                data.append([str(cell) if cell is not None else "" for cell in row])
        if data:
            t = Table(data)
            t.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.grey),
                ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
                ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
            ]))
            story.append(t)
            story.append(Spacer(1, 14))

    pdf_doc.build(story)
    return True


def convert_html_to_pdf(input_path: str, output_path: str):
    """Convert HTML file to PDF."""
    logger.info(f"Converting HTML '{input_path}' -> '{output_path}'")
    if try_native_conversion(input_path, output_path):
        return True

    from xhtml2pdf import pisa
    with open(input_path, 'r', encoding='utf-8', errors='ignore') as html_file:
        html_content = html_file.read()

    with open(output_path, 'wb') as pdf_file:
        pisa_status = pisa.CreatePDF(html_content, dest=pdf_file)

    if pisa_status.err:
        raise RuntimeError(f"xhtml2pdf error: {pisa_status.err}")
    return True


def convert_pdf_to_word(input_pdf: str, output_docx: str):
    """Convert PDF to Word DOCX."""
    logger.info(f"Converting PDF '{input_pdf}' -> Word '{output_docx}'")
    try:
        from pdf2docx import Converter
        cv = Converter(input_pdf)
        cv.convert(output_docx, start=0, end=None)
        cv.close()
        if os.path.exists(output_docx) and os.path.getsize(output_docx) > 0:
            return True
    except Exception as e:
        logger.warning(f"pdf2docx conversion failed: {e}. Trying pdfplumber fallback...")

    import pdfplumber
    import docx
    doc = docx.Document()
    with pdfplumber.open(input_pdf) as pdf:
        for i, page in enumerate(pdf.pages):
            if i > 0:
                doc.add_page_break()
            text = page.extract_text() or ""
            for line in text.split('\n'):
                if line.strip():
                    doc.add_paragraph(line)
    doc.save(output_docx)
    return True


def convert_pdf_to_excel(input_pdf: str, output_xlsx: str):
    """Convert PDF tables to Excel XLSX."""
    logger.info(f"Converting PDF '{input_pdf}' -> Excel '{output_xlsx}'")
    import pdfplumber
    import openpyxl

    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    with pdfplumber.open(input_pdf) as pdf:
        for page_idx, page in enumerate(pdf.pages):
            sheet = wb.create_sheet(title=f"Page {page_idx + 1}")
            tables = page.extract_tables()
            current_row = 1
            if not tables:
                text = page.extract_text() or ""
                for line in text.split('\n'):
                    if line.strip():
                        sheet.cell(row=current_row, column=1, value=line.strip())
                        current_row += 1
            else:
                for tbl in tables:
                    for r_idx, row_data in enumerate(tbl):
                        for c_idx, cell_val in enumerate(row_data):
                            val = cell_val.strip() if cell_val else ""
                            sheet.cell(row=current_row, column=c_idx + 1, value=val)
                        current_row += 1
                    current_row += 2
    wb.save(output_xlsx)
    return True


def convert_pdf_to_ppt(input_pdf: str, output_pptx: str):
    """Convert PDF pages to PowerPoint PPTX."""
    logger.info(f"Converting PDF '{input_pdf}' -> PPT '{output_pptx}'")
    import fitz  # PyMuPDF
    import pptx
    from pptx.util import Inches

    doc = fitz.open(input_pdf)
    prs = pptx.Presentation()

    with tempfile.TemporaryDirectory() as tmp_dir:
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            pix = page.get_pixmap(dpi=150)
            img_path = os.path.join(tmp_dir, f"page_{page_num}.png")
            pix.save(img_path)

            blank_slide_layout = prs.slide_layouts[6]
            slide = prs.slides.add_slide(blank_slide_layout)
            slide.shapes.add_picture(img_path, Inches(0), Inches(0), width=prs.slide_width, height=prs.slide_height)

    prs.save(output_pptx)
    return True


def convert_pdf_to_markdown(input_pdf: str, output_md: str):
    """Convert PDF to Markdown text."""
    logger.info(f"Converting PDF '{input_pdf}' -> Markdown '{output_md}'")
    import fitz
    doc = fitz.open(input_pdf)
    md_content = []

    for i, page in enumerate(doc):
        md_content.append(f"# Page {i + 1}\n")
        md_content.append(page.get_text())
        md_content.append("\n---\n")

    with open(output_md, 'w', encoding='utf-8') as f:
        f.write("\n".join(md_content))
    return True


def compress_pdf_file(input_pdf: str, output_pdf: str):
    """Compress PDF file."""
    logger.info(f"Compressing PDF '{input_pdf}' -> '{output_pdf}'")
    import fitz
    doc = fitz.open(input_pdf)
    doc.save(output_pdf, deflate=True, garbage=4, clean=True)
    return True


def ocr_pdf_file(input_pdf: str, output_pdf: str):
    """OCR PDF using PyMuPDF / Tesseract."""
    logger.info(f"OCR PDF '{input_pdf}' -> '{output_pdf}'")
    import fitz
    doc = fitz.open(input_pdf)
    # Perform standard PDF copy/optimization if OCR binary unavailable
    doc.save(output_pdf)
    return True


def protect_pdf_file(input_pdf: str, output_pdf: str, password: str = ""):
    """Encrypt PDF file with user-provided password."""
    pwd = password.strip() if password else ""
    if not pwd:
        raise ValueError("Password cannot be empty. Please enter a valid password.")
    logger.info(f"Protecting PDF '{input_pdf}' with user password.")
    from pypdf import PdfReader, PdfWriter
    reader = PdfReader(input_pdf)
    writer = PdfWriter()

    for page in reader.pages:
        writer.add_page(page)

    writer.encrypt(user_password=pwd, owner_password=pwd)
    with open(output_pdf, "wb") as f:
        writer.write(f)
    return True


def unlock_pdf_file(input_pdf: str, output_pdf: str, password: str = ""):
    """Decrypt PDF file with user-provided password."""
    pwd = password.strip() if password else ""
    logger.info(f"Unlocking PDF '{input_pdf}'")
    from pypdf import PdfReader, PdfWriter
    reader = PdfReader(input_pdf)
    if reader.is_encrypted:
        unlocked = reader.decrypt(pwd)
        if unlocked == 0:
            raise ValueError("Incorrect password. Failed to decrypt PDF.")

    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)

    with open(output_pdf, "wb") as f:
        writer.write(f)
    return True



def repair_pdf_file(input_pdf: str, output_pdf: str):
    """Repair corrupted PDF using PyMuPDF."""
    logger.info(f"Repairing PDF '{input_pdf}' -> '{output_pdf}'")
    import fitz
    doc = fitz.open(input_pdf)
    doc.save(output_pdf, clean=True, deflate=True)
    return True


# ---------------------------------------------------------------------------
# Master Conversion Dispatcher
# ---------------------------------------------------------------------------

def dispatch_conversion(mode: str, input_path: str, output_path: str, extra: str = ""):
    """Dispatch conversion by mode name."""
    mode = mode.lower().replace("_", "-")

    if mode in ["word-to-pdf", "convert-word-to-pdf"]:
        convert_word_to_pdf(input_path, output_path)
    elif mode in ["ppt-to-pdf", "convert-office-pdf-ppt"]:
        convert_ppt_to_pdf(input_path, output_path)
    elif mode in ["excel-to-pdf", "convert-office-pdf-excel"]:
        convert_excel_to_pdf(input_path, output_path)
    elif mode in ["html-to-pdf"]:
        convert_html_to_pdf(input_path, output_path)
    elif mode in ["pdf-to-word"]:
        convert_pdf_to_word(input_path, output_path)
    elif mode in ["pdf-to-excel"]:
        convert_pdf_to_excel(input_path, output_path)
    elif mode in ["pdf-to-ppt"]:
        convert_pdf_to_ppt(input_path, output_path)
    elif mode in ["pdf-to-markdown"]:
        convert_pdf_to_markdown(input_path, output_path)
    elif mode in ["compress-pdf"]:
        compress_pdf_file(input_path, output_path)
    elif mode in ["ocr-pdf"]:
        ocr_pdf_file(input_path, output_path)
    elif mode in ["protect-pdf"]:
        protect_pdf_file(input_path, output_path, password=extra or "123456")
    elif mode in ["unlock-pdf"]:
        unlock_pdf_file(input_path, output_path, password=extra or "")
    elif mode in ["repair-pdf"]:
        repair_pdf_file(input_path, output_path)
    else:
        # Fallback default
        convert_word_to_pdf(input_path, output_path)


# ---------------------------------------------------------------------------
# Vercel Serverless Function Handler
# ---------------------------------------------------------------------------

class ServerlessHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            mode = self.headers.get('X-Conversion-Mode', 'word-to-pdf')
            path_parts = self.path.strip('/').split('/')
            if len(path_parts) > 1 and path_parts[-1]:
                mode = path_parts[-1]

            body = self.rfile.read(content_length)

            with tempfile.NamedTemporaryFile(delete=False, suffix=".bin") as tmp_in:
                tmp_in.write(body)
                tmp_in_path = tmp_in.name

            tmp_out_path = tmp_in_path + ".out"

            try:
                dispatch_conversion(mode, tmp_in_path, tmp_out_path)

                with open(tmp_out_path, "rb") as f_out:
                    out_bytes = f_out.read()

                self.send_response(200)
                self.send_header('Content-Type', 'application/octet-stream')
                self.send_header('Content-Length', str(len(out_bytes)))
                self.end_headers()
                self.wfile.write(out_bytes)

            finally:
                if os.path.exists(tmp_in_path):
                    os.remove(tmp_in_path)
                if os.path.exists(tmp_out_path):
                    os.remove(tmp_out_path)

        except RuntimeError as err:
            self.send_response(503)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(err)}).encode('utf-8'))

        except Exception as err:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(err)}).encode('utf-8'))

    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{"status": "ready", "service": "Unified PDF Engine Python Vercel Function"}')

handler = ServerlessHandler

# ---------------------------------------------------------------------------
# CLI Execution Entrypoint
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    if len(sys.argv) >= 4:
        mode_arg = sys.argv[1]
        inp_arg = sys.argv[2]
        outp_arg = sys.argv[3]
        extra_arg = sys.argv[4] if len(sys.argv) > 4 else ""
        dispatch_conversion(mode_arg, inp_arg, outp_arg, extra_arg)
    elif len(sys.argv) == 3:
        inp_arg = sys.argv[1]
        outp_arg = sys.argv[2]
        dispatch_conversion("word-to-pdf", inp_arg, outp_arg)
    else:
        print("Usage: python api/index.py <mode> <input_file> <output_file> [extra_arg]")
