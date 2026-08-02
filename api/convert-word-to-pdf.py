import sys
import os
import io
import tempfile
import traceback
import subprocess
from http.server import BaseHTTPRequestHandler
import re

def parse_multipart(data, boundary):
    """
    Parse multipart/form-data payload without using deprecated cgi module.
    """
    if isinstance(boundary, str):
        boundary = boundary.encode('utf-8')
    parts = data.split(b'--' + boundary)
    for part in parts:
        if not part or part.startswith(b'--'):
            continue
        headers_end = part.find(b'\r\n\r\n')
        if headers_end == -1:
            continue
        headers_raw = part[:headers_end].decode('utf-8', errors='ignore')
        body = part[headers_end + 4:]
        if body.endswith(b'\r\n'):
            body = body[:-2]
        
        # Check Content-Disposition header
        match = re.search(r'name="([^"]+)"', headers_raw)
        if match:
            field_name = match.group(1)
            filename_match = re.search(r'filename="([^"]+)"', headers_raw)
            filename = filename_match.group(1) if filename_match else "uploaded.docx"
            return field_name, filename, body
    return None, None, None


def try_native_conversion(input_path, output_path):
    """
    Attempt native MS Word / LibreOffice conversion for 100% exact replica.
    """
    # 1. Try docx2pdf via subprocess with a strict timeout (avoid COM automation hangs)
    if sys.platform in ['win32', 'darwin']:
        try:
            cmd = [sys.executable, "-c", f"from docx2pdf import convert; convert(r'{input_path}', r'{output_path}')"]
            res = subprocess.run(cmd, capture_output=True, timeout=8)
            if res.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                print(f"[Word2PDF Engine] Converted via native docx2pdf engine.")
                return True
        except Exception as e:
            print(f"[Word2PDF Engine] docx2pdf native conversion skipped/failed: {e}")

    # 2. Try headless LibreOffice / soffice CLI
    soffice_cmd = None
    for cmd in ["soffice", "libreoffice", r"C:\Program Files\LibreOffice\program\soffice.exe"]:
        if os.path.exists(cmd) if os.path.isabs(cmd) else True:
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
                timeout=30
            )
            # LibreOffice names output file <basename>.pdf
            expected_pdf = os.path.splitext(input_path)[0] + ".pdf"
            if os.path.exists(expected_pdf):
                if expected_pdf != output_path:
                    os.replace(expected_pdf, output_path)
                print(f"[Word2PDF Engine] Converted via LibreOffice headless.")
                return True
        except Exception as e:
            print(f"[Word2PDF Engine] LibreOffice conversion failed: {e}")

    return False


def convert_docx_to_pdf_reportlab(input_path, output_path):
    """
    High-fidelity pure Python DOCX to PDF converter using python-docx and ReportLab.
    Parses typography, colors, headings, alignments, lists, tables (with borders & shading),
    and embedded inline images.
    """
    import docx
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.enum.table import WD_TABLE_ALIGNMENT
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn

    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib.units import inch, cm, mm
    pt = 1
    from reportlab.lib import colors
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable, KeepTogether
    )
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
    from PIL import Image as PILImage

    doc = docx.Document(input_path)

    # Page Margins
    section = doc.sections[0]
    top_margin = section.top_margin.pt if section.top_margin else 54
    bottom_margin = section.bottom_margin.pt if section.bottom_margin else 54
    left_margin = section.left_margin.pt if section.left_margin else 54
    right_margin = section.right_margin.pt if section.right_margin else 54

    page_width = section.page_width.pt if section.page_width else 612
    page_height = section.page_height.pt if section.page_height else 792

    pdf_doc = SimpleDocTemplate(
        output_path,
        pagesize=(page_width, page_height),
        leftMargin=left_margin,
        rightMargin=right_margin,
        topMargin=top_margin,
        bottomMargin=bottom_margin
    )

    usable_width = page_width - left_margin - right_margin
    styles = getSampleStyleSheet()
    story = []

    def hex_to_color(color_hex, default=colors.black):
        if not color_hex or color_hex == "auto":
            return default
        try:
            hex_clean = color_hex.lstrip("#")
            if len(hex_clean) == 6:
                r = int(hex_clean[0:2], 16) / 255.0
                g = int(hex_clean[2:4], 16) / 255.0
                b = int(hex_clean[4:6], 16) / 255.0
                return colors.Color(r, g, b)
        except Exception:
            pass
        return default

    align_map = {
        WD_ALIGN_PARAGRAPH.LEFT: TA_LEFT,
        WD_ALIGN_PARAGRAPH.CENTER: TA_CENTER,
        WD_ALIGN_PARAGRAPH.RIGHT: TA_RIGHT,
        WD_ALIGN_PARAGRAPH.JUSTIFY: TA_JUSTIFY,
    }

    style_idx = 0

    def convert_paragraph(p):
        nonlocal style_idx
        if not p.text.strip() and not any(r._element.xpath('.//w:drawing') for r in p.runs):
            return Spacer(1, 8)

        align = align_map.get(p.alignment, TA_LEFT)

        # Build formatted HTML text from runs
        html_chunks = []
        base_font_size = 11
        is_heading = False

        if p.style.name.startswith("Heading"):
            is_heading = True
            try:
                level = int(p.style.name.replace("Heading", "").strip())
                base_font_size = max(24 - (level * 3), 12)
            except Exception:
                base_font_size = 16

        for run in p.runs:
            # Check for embedded images in run
            drawings = run._element.xpath('.//w:drawing')
            if drawings:
                for drawing in drawings:
                    blips = drawing.xpath('.//a:blip/@r:embed')
                    if blips:
                        rId = blips[0]
                        image_part = doc.part.related_parts.get(rId)
                        if image_part:
                            try:
                                img_bytes = image_part.blob
                                img_stream = io.BytesIO(img_bytes)
                                pil_img = PILImage.open(img_stream)
                                w, h = pil_img.size
                                # Scale image to fit within page width
                                max_w = usable_width
                                if w > max_w:
                                    ratio = max_w / float(w)
                                    w = max_w
                                    h = h * ratio
                                else:
                                    w = w * 0.75
                                    h = h * 0.75
                                temp_img_stream = io.BytesIO(img_bytes)
                                img_flowable = Image(temp_img_stream, width=w, height=h)
                                img_flowable.hAlign = 'CENTER' if align == TA_CENTER else 'LEFT'
                                story.append(img_flowable)
                            except Exception as img_err:
                                print(f"[Word2PDF] Image extraction error: {img_err}")

            text = run.text
            if not text:
                continue

            # Escape HTML special chars
            text_escaped = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('\n', '<br/>')

            run_size = run.font.size.pt if run.font and run.font.size else base_font_size
            font_color = None
            if run.font and run.font.color and run.font.color.rgb:
                font_color = f"#{run.font.color.rgb}"
            
            style_tags_open = ""
            style_tags_close = ""

            if run.bold or is_heading:
                style_tags_open += "<b>"
                style_tags_close = "</b>" + style_tags_close
            if run.italic:
                style_tags_open += "<i>"
                style_tags_close = "</i>" + style_tags_close
            if run.underline:
                style_tags_open += "<u>"
                style_tags_close = "</u>" + style_tags_close

            font_style = f'size="{run_size}"'
            if font_color:
                font_style += f' color="{font_color}"'

            chunk = f'<font {font_style}>{style_tags_open}{text_escaped}{style_tags_close}</font>'
            html_chunks.append(chunk)

        if not html_chunks:
            return None

        full_html = "".join(html_chunks)
        style_idx += 1
        p_style = ParagraphStyle(
            name=f'CustomP_{style_idx}',
            parent=styles['Normal'],
            alignment=align,
            fontSize=base_font_size,
            leading=base_font_size * 1.3,
            textColor=colors.HexColor('#111827') if not is_heading else colors.HexColor('#be123c'),
            spaceBefore=12 if is_heading else 4,
            spaceAfter=6 if is_heading else 4
        )

        # Check if list item
        if p.style.name.startswith("List") or p.text.strip().startswith("•") or p.text.strip().startswith("-"):
            p_style.leftIndent = 18

        return Paragraph(full_html, p_style)

    def convert_table(tbl):
        nonlocal style_idx
        table_data = []
        t_styles = [
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#d1d5db')),
            ('PADDING', (0,0), (-1,-1), 6),
        ]

        row_idx = 0
        for row in tbl.rows:
            row_cells = []
            col_idx = 0
            for cell in row.cells:
                cell_flowables = []
                for p in cell.paragraphs:
                    pf = convert_paragraph(p)
                    if pf:
                        if isinstance(pf, Paragraph):
                            cell_flowables.append(pf)
                        elif isinstance(pf, Spacer):
                            pass

                if not cell_flowables:
                    cell_flowables = [Paragraph("", styles['Normal'])]

                row_cells.append(cell_flowables)

                # Shading / background color check
                tcPr = cell._tc.get_or_add_tcPr()
                shd = tcPr.xpath('.//w:shd')
                if shd:
                    fill = shd[0].get(qn('w:fill'))
                    if fill and fill != 'auto':
                        c = hex_to_color(fill, None)
                        if c:
                            t_styles.append(('BACKGROUND', (col_idx, row_idx), (col_idx, row_idx), c))
                col_idx += 1

            if row_idx == 0:
                # Header row styling
                t_styles.append(('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f3f4f6')))

            table_data.append(row_cells)
            row_idx += 1

        if not table_data:
            return None

        # Compute column widths
        col_count = max(len(r) for r in table_data)
        col_width = usable_width / float(col_count)
        col_widths = [col_width] * col_count

        t = Table(table_data, colWidths=col_widths)
        t.setStyle(TableStyle(t_styles))
        t.hAlign = 'CENTER'
        return t

    # Iterate through elements in document body order
    for elem in doc.element.body:
        if elem.tag.endswith('p'):
            from docx.text.paragraph import Paragraph as DocxParagraph
            p = DocxParagraph(elem, doc)
            res = convert_paragraph(p)
            if res:
                story.append(res)
        elif elem.tag.endswith('tbl'):
            from docx.table import Table as DocxTable
            tbl = DocxTable(elem, doc)
            t_flowable = convert_table(tbl)
            if t_flowable:
                story.append(Spacer(1, 6))
                story.append(t_flowable)
                story.append(Spacer(1, 6))

    if not story:
        story.append(Paragraph("Empty Document", styles['Normal']))

    pdf_doc.build(story)
    print(f"[Word2PDF Engine] Converted via Python-docx + ReportLab high-fidelity engine.")
    return True


def convert_word_to_pdf(input_path, output_path):
    """
    Main conversion entrypoint.
    1. Tries native OS engines (docx2pdf / LibreOffice) for 100% exact replica if available.
    2. Falls back to ReportLab + python-docx engine.
    """
    print(f"[Word2PDF] Converting '{input_path}' to '{output_path}'...")

    # Attempt native first
    if try_native_conversion(input_path, output_path):
        return True

    # Fallback to pure python engine
    try:
        return convert_docx_to_pdf_reportlab(input_path, output_path)
    except Exception as e:
        print(f"[Word2PDF Error] Pure python conversion failed: {e}")
        traceback.print_exc()
        raise e


class ServerlessHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_type = self.headers.get('Content-Type', '')
            content_length = int(self.headers.get('Content-Length', 0))

            if 'multipart/form-data' in content_type:
                raw_data = self.rfile.read(content_length)
                boundary = ""
                if 'boundary=' in content_type:
                    boundary = content_type.split('boundary=')[1].split(';')[0].strip('"')
                
                _, filename, input_bytes = parse_multipart(raw_data, boundary)
                if not input_bytes:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b'{"error": "Failed to parse file from multipart request"}')
                    return
                if not filename:
                    filename = "uploaded.docx"
            else:
                input_bytes = self.rfile.read(content_length)
                filename = "uploaded.docx"

            with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as tmp_in:
                tmp_in.write(input_bytes)
                tmp_in_path = tmp_in.name

            tmp_out_path = tmp_in_path + ".pdf"

            try:
                convert_word_to_pdf(tmp_in_path, tmp_out_path)

                with open(tmp_out_path, "rb") as f_out:
                    pdf_bytes = f_out.read()

                self.send_response(200)
                self.send_header('Content-Type', 'application/pdf')
                self.send_header('Content-Length', str(len(pdf_bytes)))
                self.send_header('Content-Disposition', f'attachment; filename="{os.path.splitext(filename)[0]}.pdf"')
                self.end_headers()
                self.wfile.write(pdf_bytes)

            finally:
                if os.path.exists(tmp_in_path):
                    os.remove(tmp_in_path)
                if os.path.exists(tmp_out_path):
                    os.remove(tmp_out_path)

        except Exception as err:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            err_msg = f'{{"error": "{str(err)}"}}'
            self.wfile.write(err_msg.encode('utf-8'))

    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{"status": "ready", "service": "Word-to-PDF Replication API"}')

# Vercel Serverless Function entry point handler
handler = ServerlessHandler

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--test':
        print("Testing imports and conversion engine...")
        import docx
        import reportlab
        print(f"python-docx version: {docx.__version__}")
        print(f"reportlab version: {reportlab.__version__}")
        print("Ready!")
        sys.exit(0)

    if len(sys.argv) >= 3:
        inp = sys.argv[1]
        outp = sys.argv[2]
        convert_word_to_pdf(inp, outp)
    else:
        print("Usage: python convert-word-to-pdf.py <input.docx> <output.pdf>")
