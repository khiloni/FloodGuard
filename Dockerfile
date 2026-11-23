# ---- Stage 1: build the frontend ----
FROM node:20-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: backend + built frontend ----
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    LLM_MODE=template \
    PORT=10000

WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY scenarios/ ./scenarios/
COPY rulecards/ ./rulecards/
COPY --from=web /web/dist ./backend/static

# /data holds the SQLite file when a volume is mounted there (docker-compose.yml).
RUN useradd -m appuser && mkdir -p /data && chown -R appuser /app /data
USER appuser

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import os,urllib.request;urllib.request.urlopen('http://localhost:'+os.environ.get('PORT','10000')+'/api/v1/health')"

CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT}"]
