import os
import sys
import io
import time
import logging
import tempfile
import subprocess
from flask import Flask, request, send_file, jsonify

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger("word_to_pdf_service")

app = Flask(__name__)

# Configuration & limits
MAX_FILE_SIZE_MB = int(os.environ.get("MAX_FILE_SIZE_MB", "50"))
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
CONVERSION_TIMEOUT_SECONDS = int(os.environ.get("CONVERSION_TIMEOUT_SECONDS", "45"))
ALLOWED_EXTENSIONS = {'.docx', '.doc'}
ALLOWED_MIME_TYPES = {
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/octet-stream'
}

def find_libreoffice_binary():
    """Locate LibreOffice headless executable and return (command, version_string)."""
    candidates = ["soffice", "libreoffice", r"C:\Program Files\LibreOffice\program\soffice.exe"]
    for cmd in candidates:
        try:
            res = subprocess.run([cmd, "--version"], capture_output=True, timeout=3)
            if res.returncode == 0:
                version = res.stdout.decode('utf-8', errors='ignore').strip()
                return cmd, version
        except Exception:
            continue
    return None, None

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint to verify service and LibreOffice engine availability."""
    soffice_cmd, soffice_ver = find_libreoffice_binary()
    if soffice_cmd:
        return jsonify({
            "status": "ok",
            "engine": "LibreOffice",
            "libreoffice_available": True,
            "version": soffice_ver
        }), 200
    else:
        return jsonify({
            "status": "degraded",
            "engine": "none",
            "libreoffice_available": False,
            "error": "LibreOffice binary not found on system path"
        }), 503

@app.route('/', methods=['GET'])
def index():
    return jsonify({
        "service": "Word-to-PDF Conversion Engine",
        "health_endpoint": "/health",
        "convert_endpoint": "/convert"
    }), 200

@app.route('/convert', methods=['POST'])
@app.route('/api/word-to-pdf', methods=['POST'])
def convert_word_to_pdf():
    """
    Main conversion endpoint.
    Accepts multipart/form-data with 'file' field or raw body stream.
    Converts Word (.docx/.doc) to PDF using LibreOffice headless.
    """
    start_time = time.time()
    soffice_cmd, soffice_ver = find_libreoffice_binary()

    # Rule 7: If LibreOffice is unavailable, return JSON error instead of low-quality fallback
    if not soffice_cmd:
        logger.error("[ERROR] Conversion requested but LibreOffice conversion engine is unavailable.")
        return jsonify({"error": "LibreOffice conversion engine is unavailable on the server"}), 503

    filename = "uploaded.docx"
    file_bytes = b""

    # Extract file from multipart request or raw body
    if 'file' in request.files:
        uploaded_file = request.files['file']
        filename = uploaded_file.filename or "uploaded.docx"
        file_bytes = uploaded_file.read()
    elif request.data:
        file_bytes = request.data
        filename = request.args.get("filename", "uploaded.docx")

    # Rule 12: File size validation
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        logger.error(f"[ERROR] File size ({len(file_bytes)} bytes) exceeds limit ({MAX_FILE_SIZE_BYTES} bytes).")
        return jsonify({"error": f"File size exceeds maximum allowed limit of {MAX_FILE_SIZE_MB}MB"}), 413

    if len(file_bytes) == 0:
        logger.error("[ERROR] Empty file received in request.")
        return jsonify({"error": "No file uploaded or file content is empty"}), 400

    # Rule 13: MIME type / Extension validation
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        logger.error(f"[ERROR] Invalid file extension '{ext}'. Only .docx and .doc are supported.")
        return jsonify({"error": f"Invalid file type '{ext}'. Only .docx and .doc files are supported."}), 400

    # Rules 9 & 10: Safe temporary file handling and guaranteed cleanup
    with tempfile.TemporaryDirectory() as tmp_dir:
        input_file_path = os.path.join(tmp_dir, filename)
        with open(input_file_path, "wb") as f_in:
            f_in.write(file_bytes)

        logger.info(f"[INFO] Starting conversion | Engine: {soffice_ver} | Input file: '{filename}' ({len(file_bytes)} bytes)")

        try:
            # Rule 5 & 11: Execute LibreOffice with timeout protection
            cmd = [
                soffice_cmd,
                "--headless",
                "--convert-to", "pdf",
                "--outdir", tmp_dir,
                input_file_path
            ]

            res = subprocess.run(
                cmd,
                capture_output=True,
                timeout=CONVERSION_TIMEOUT_SECONDS
            )

            if res.returncode != 0:
                err_details = res.stderr.decode('utf-8', errors='ignore').strip()
                logger.error(f"[ERROR] LibreOffice process exit code {res.returncode}: {err_details}")
                return jsonify({"error": f"Conversion engine error: {err_details or 'Unknown error'}"}), 500

            expected_pdf_path = os.path.splitext(input_file_path)[0] + ".pdf"
            if not os.path.exists(expected_pdf_path) or os.path.getsize(expected_pdf_path) == 0:
                logger.error(f"[ERROR] Expected PDF output file not generated at '{expected_pdf_path}'.")
                return jsonify({"error": "Conversion engine failed to produce output PDF file"}), 500

            with open(expected_pdf_path, "rb") as f_out:
                pdf_data = f_out.read()

            execution_time = time.time() - start_time
            # Rule 8: Proper logging for conversion engine, execution time, and file metrics
            logger.info(f"[SUCCESS] Engine: {soffice_ver} | Execution time: {execution_time:.2f}s | PDF output: {len(pdf_data)} bytes")

            out_basename = os.path.splitext(os.path.basename(filename))[0] + ".pdf"

            return send_file(
                io.BytesIO(pdf_data),
                mimetype='application/pdf',
                as_attachment=True,
                download_name=out_basename
            )

        except subprocess.TimeoutExpired:
            execution_time = time.time() - start_time
            logger.error(f"[ERROR] Conversion timed out after {CONVERSION_TIMEOUT_SECONDS}s (Execution time: {execution_time:.2f}s)")
            return jsonify({"error": f"Document conversion timed out after {CONVERSION_TIMEOUT_SECONDS} seconds"}), 504
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"[ERROR] Conversion error after {execution_time:.2f}s: {str(e)}")
            return jsonify({"error": f"Conversion error: {str(e)}"}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8000))
    app.run(host='0.0.0.0', port=port)
