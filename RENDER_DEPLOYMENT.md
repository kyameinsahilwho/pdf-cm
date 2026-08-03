# Render Deployment Guide: Dedicated Word → PDF Microservice

This document outlines the deployment, configuration, and integration of the dedicated **Word to PDF Microservice** on **Render** using Docker and headless LibreOffice.

---

## 1. Generated & Modified Files Summary

| File Path | Action | Description & Purpose |
|:---|:---|:---|
| [`services/word-to-pdf/app.py`](file:///d:/SKS%20coding/pdf-cm/services/word-to-pdf/app.py) | **[NEW]** | Production Flask microservice handling `/convert` (POST) and `/health` (GET). Implements LibreOffice headless conversion, file size validation, MIME checks, timeout protection, temporary directory isolation, and structured logging. |
| [`services/word-to-pdf/Dockerfile`](file:///d:/SKS%20coding/pdf-cm/services/word-to-pdf/Dockerfile) | **[NEW]** | Dockerfile based on `python:3.11-slim-bookworm` with LibreOffice, Liberation/DejaVu/Noto font packages, `fontconfig` cache refresh, and `gunicorn` runner. |
| [`services/word-to-pdf/requirements.txt`](file:///d:/SKS%20coding/pdf-cm/services/word-to-pdf/requirements.txt) | **[NEW]** | Microservice-specific Python dependencies (`flask`, `gunicorn`, `python-multipart`, `requests`). |
| [`Dockerfile`](file:///d:/SKS%20coding/pdf-cm/Dockerfile) | **[NEW]** | Monorepo root Dockerfile enabling direct container deployment on Render from the repository root. |
| [`render.yaml`](file:///d:/SKS%20coding/pdf-cm/render.yaml) | **[NEW]** | Render Blueprint configuration defining the `word-to-pdf-service` Web Service with health check and environment variables. |
| [`src/app/api/word-to-pdf/route.ts`](file:///d:/SKS%20coding/pdf-cm/src/app/api/word-to-pdf/route.ts) | **[MODIFY]** | Next.js API route updated to check `WORD_TO_PDF_SERVICE_URL`. Forwards file conversion requests to the Render service if set, maintaining the exact same contract. |
| [`api/convert-word-to-pdf.py`](file:///d:/SKS%20coding/pdf-cm/api/convert-word-to-pdf.py) | **[MODIFY]** | Updated legacy Python entrypoint to disable low-quality ReportLab fallback and return an HTTP 503 JSON error if LibreOffice is missing. |
| [`requirements.txt`](file:///d:/SKS%20coding/pdf-cm/requirements.txt) | **[MODIFY]** | Updated monorepo root requirements file to include Render microservice requirements. |
| [`RENDER_DEPLOYMENT.md`](file:///d:/SKS%20coding/pdf-cm/RENDER_DEPLOYMENT.md) | **[NEW]** | Complete deployment guide, API contract reference, curl examples, and Next.js integration code. |

---

## 2. Environment Variables

### Microservice Environment Variables (Render)

| Variable | Default Value | Description |
|:---|:---|:---|
| `PORT` | `8000` (Render sets automatically) | Dynamic port provided by Render for HTTP binding. |
| `MAX_FILE_SIZE_MB` | `50` | Maximum allowed upload size in megabytes. |
| `CONVERSION_TIMEOUT_SECONDS` | `45` | Subprocess execution timeout for LibreOffice conversion. |

### Next.js Frontend Environment Variables (Vercel / Local)

| Variable | Example Value | Description |
|:---|:---|:---|
| `WORD_TO_PDF_SERVICE_URL` | `https://word-to-pdf-service.onrender.com` | Base URL of the deployed Render conversion microservice. |

---

## 3. Health Check Endpoint (`/health`)

- **Method**: `GET`
- **URL**: `https://<your-render-service>.onrender.com/health`
- **Response (200 OK)**:
```json
{
  "status": "ok",
  "engine": "LibreOffice",
  "libreoffice_available": true,
  "version": "LibreOffice 7.4.7.2 40(Build:2)"
}
```
- **Response (503 Service Unavailable)** (If binary missing):
```json
{
  "status": "degraded",
  "engine": "none",
  "libreoffice_available": false,
  "error": "LibreOffice binary not found on system path"
}
```

---

## 4. Deployment Instructions for Render

### Method A: Blueprint Deployment (Recommended)
1. Push your repository code to GitHub or GitLab.
2. Log into your [Render Dashboard](https://dashboard.render.com/).
3. Click **New +** -> **Blueprint**.
4. Connect your monorepo repository.
5. Render will automatically read [`render.yaml`](file:///d:/SKS%20coding/pdf-cm/render.yaml) and provision the `word-to-pdf-service` Web Service.
6. Click **Apply**.

### Method B: Manual Web Service Deployment
1. Log into your Render Dashboard.
2. Click **New +** -> **Web Service**.
3. Select **Build and deploy from a Git repository**.
4. Choose Docker as the runtime.
5. Set **Dockerfile Path** to `Dockerfile` (or `services/word-to-pdf/Dockerfile`).
6. Set Health Check Path to `/health`.
7. Add Environment Variables (`MAX_FILE_SIZE_MB=50`, `CONVERSION_TIMEOUT_SECONDS=45`).
8. Deploy Service.

---

## 5. Example `curl` Request

```bash
# Health check
curl -X GET https://your-word-to-pdf-service.onrender.com/health

# Convert Word document to PDF
curl -X POST https://your-word-to-pdf-service.onrender.com/convert \
  -F "file=@/path/to/sample.docx" \
  --output sample_converted.pdf
```

---

## 6. Example Next.js Fetch Code

Here is how the Next.js API route proxies requests to the Render service:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const serviceUrl = process.env.WORD_TO_PDF_SERVICE_URL;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided in request' }, { status: 400 });
    }

    if (serviceUrl) {
      const targetUrl = `${serviceUrl.replace(/\/+$/, '')}/convert`;
      const outboundFormData = new FormData();
      outboundFormData.append('file', file, file.name);

      const res = await fetch(targetUrl, {
        method: 'POST',
        body: outboundFormData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: 'Conversion failed' }));
        return NextResponse.json({ error: errJson.error }, { status: res.status });
      }

      const pdfBuffer = await res.arrayBuffer();
      const filename = file.name.replace(/\.[^/.]+$/, '');

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}.pdf"`,
        },
      });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
```
