FROM python:3.11-slim-bookworm

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PORT=8000
ENV MAX_FILE_SIZE_MB=50
ENV CONVERSION_TIMEOUT_SECONDS=60

# Install LibreOffice headless (Writer, Calc, Impress), font packages, and font utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    fonts-liberation \
    fonts-dejavu \
    fonts-dejavu-core \
    fonts-noto \
    fonts-noto-core \
    fonts-freefont-ttf \
    fontconfig \
    curl \
    cabextract \
    && rm -rf /var/lib/apt/lists/*

# Rebuild system font cache for LibreOffice document rendering
RUN fc-cache -f -v

# Set working directory
WORKDIR /app

# Copy service dependencies and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy microservice application code
COPY app.py .

# Expose default port
EXPOSE 8000

# Start Gunicorn server binding to Render dynamic PORT
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-8000} --workers 2 --threads 4 --timeout 60 app:app"]
