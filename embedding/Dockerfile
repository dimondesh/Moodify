FROM python:3.9-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

COPY models/ models/
COPY app.py .

EXPOSE 5006

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "5006"]
