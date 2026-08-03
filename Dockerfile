FROM python:3.11-slim-bookworm

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PORT=8000
ENV MAX_FILE_SIZE_MB=50
ENV CONVERSION_TIMEOUT_SECONDS=45

RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    libreoffice-writer \
    fonts-liberation \
    fonts-dejavu-core \
    fonts-noto-core \
    fonts-freefont-ttf \
    fontconfig \
    curl \
    cabextract \
    && rm -rf /var/lib/apt/lists/*

RUN fc-cache -f -v

WORKDIR /app

COPY services/word-to-pdf/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY services/word-to-pdf/app.py ./

EXPOSE 8000

CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-8000} --workers 2 --threads 4 --timeout 60 app:app"]
