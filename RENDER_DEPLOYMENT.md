# Render Deployment & Single-File Vercel Consolidation Guide

This document outlines the deployment, configuration, and architecture of the **Universal Document Conversion Microservice** on **Render** alongside the **Single-File Vercel API Consolidation**.

---

## 1. Summary of Architectural Improvements

### A. Single Python File in `api/` (`api/index.py`)
- **Problem**: Vercel created 20 separate Python build tasks when multiple `.py` files existed under `api/`, causing builds to take over 10 minutes or fail due to timeouts.
- **Solution**: Consolidated all conversion logic into **a single Python file (`api/index.py`)**. Vercel now builds **only 1 Python Serverless Function**, drastically reducing deployment time.

### B. Universal Render Microservice (`services/word-to-pdf/app.py`)
- Supported Tools:
  - **Office → PDF**: `word-to-pdf`, `ppt-to-pdf`, `excel-to-pdf`, `html-to-pdf` (via LibreOffice Headless)
  - **PDF → Office / Text**: `pdf-to-word`, `pdf-to-excel`, `pdf-to-ppt`, `pdf-to-markdown`
  - **PDF Tools**: `compress-pdf`, `ocr-pdf`, `protect-pdf`, `unlock-pdf`, `edit-pdf`, `redact-pdf`, `repair-pdf`, `inspect-pdf`
- Primary engine for Word/PPT/Excel/HTML conversion: **LibreOffice Headless (`soffice`)** inside Docker container.

---

## 2. Updated File Inventory

| File Path | Action | Description & Purpose |
|:---|:---|:---|
| [`api/index.py`](file:///d:/SKS%20coding/pdf-cm/api/index.py) | **[NEW]** | The **ONLY** Python file in `api/`. Contains master dispatch logic and CLI/HTTP handlers for all 17 tools. Optimizes Vercel build performance. |
| [`services/word-to-pdf/app.py`](file:///d:/SKS%20coding/pdf-cm/services/word-to-pdf/app.py) | **[MODIFY]** | Universal Flask microservice handling conversion requests for all tools via `/convert/<tool_name>`. |
| [`services/word-to-pdf/requirements.txt`](file:///d:/SKS%20coding/pdf-cm/services/word-to-pdf/requirements.txt) | **[MODIFY]** | Container dependencies including `flask`, `gunicorn`, `pymupdf`, `pdf2docx`, `pdfplumber`, `pypdf`, `python-docx`, `python-pptx`, `openpyxl`, `reportlab`, `xhtml2pdf`. |
| [`src/lib/server-python-runner.ts`](file:///d:/SKS%20coding/pdf-cm/src/lib/server-python-runner.ts) | **[MODIFY]** | Enhanced with `handleConversionRequest` helper. Automatically proxies requests to `PDF_ENGINE_SERVICE_URL` when set, or calls local `api/index.py`. |
| [`src/app/api/*/route.ts`](file:///d:/SKS%20coding/pdf-cm/src/app/api/word-to-pdf/route.ts) | **[MODIFY]** | Updated 17 Next.js API routes to use clean 3-line handlers calling `handleConversionRequest`. |
| [`render.yaml`](file:///d:/SKS%20coding/pdf-cm/render.yaml) | **[MODIFY]** | Render Blueprint deployment file for `word-to-pdf-service`. |

---

## 3. Environment Variables

| Variable | Example / Default | Target Environment | Purpose |
|:---|:---|:---|:---|
| `PDF_ENGINE_SERVICE_URL` | `https://word-to-pdf-service.onrender.com` | Vercel / Next.js `.env` | URL of deployed Render container service. |
| `WORD_TO_PDF_SERVICE_URL` | `https://word-to-pdf-service.onrender.com` | Vercel / Next.js `.env` | Alternative URL for Word to PDF conversion service. |
| `MAX_FILE_SIZE_MB` | `50` | Render Container | Maximum allowed upload size in MB. |
| `CONVERSION_TIMEOUT_SECONDS` | `60` | Render Container | Subprocess timeout for LibreOffice conversion. |
| `PORT` | `10000` | Render Container | Dynamic HTTP binding port assigned by Render. |

---

## 4. Endpoints & Usage Examples

### Health Check Endpoint (`GET /health`)
```bash
curl -X GET https://your-render-service.onrender.com/health
```
```json
{
  "status": "ok",
  "engine": "LibreOffice + PyMuPDF + pdf2docx",
  "libreoffice_available": true,
  "libreoffice_version": "LibreOffice 7.4.7.2",
  "supported_tools": [
    "word-to-pdf", "ppt-to-pdf", "excel-to-pdf", "html-to-pdf",
    "pdf-to-word", "pdf-to-excel", "pdf-to-ppt", "pdf-to-markdown",
    "compress-pdf", "ocr-pdf", "protect-pdf", "unlock-pdf", "repair-pdf"
  ]
}
```

### Example Conversion Requests (`POST /convert/<tool_name>`)

#### Word to PDF
```bash
curl -X POST https://your-render-service.onrender.com/convert/word-to-pdf \
  -F "file=@document.docx" \
  --output document.pdf
```

#### PowerPoint to PDF
```bash
curl -X POST https://your-render-service.onrender.com/convert/ppt-to-pdf \
  -F "file=@presentation.pptx" \
  --output presentation.pdf
```

#### Excel to PDF
```bash
curl -X POST https://your-render-service.onrender.com/convert/excel-to-pdf \
  -F "file=@spreadsheet.xlsx" \
  --output spreadsheet.pdf
```

#### PDF to Word
```bash
curl -X POST https://your-render-service.onrender.com/convert/pdf-to-word \
  -F "file=@document.pdf" \
  --output document.docx
```
