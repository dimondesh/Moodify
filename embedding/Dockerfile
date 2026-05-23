FROM python:3.9-slim

# Устанавливаем системные библиотеки для работы со звуком и скачивания модели
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Скачиваем веса нейросети MusiCNN
RUN wget https://essentia.upf.edu/models/feature-extractors/musicnn/msd-musicnn-1.pb

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5006

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "5006"]