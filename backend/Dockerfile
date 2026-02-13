# MemberCore API - for Google Cloud Run (or any container host)
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code (no .env; use Cloud Run env vars or Secret Manager)
COPY app ./app

# Cloud Run expects PORT env; default 8080
ENV PORT=8080
EXPOSE 8080

# Run with host 0.0.0.0 so the container accepts external connections
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
