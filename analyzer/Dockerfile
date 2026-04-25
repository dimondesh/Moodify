# --- Базовый образ с Essentia ---
FROM ghcr.io/mtg/essentia:latest

# --- Установка системных зависимостей ---
# Добавляем python3-dev, он нужен для компиляции C-расширений
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3-pip \
    python3-dev \
    build-essential \
    gcc \
    g++ \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Обновляем pip
RUN pip3 install --no-cache-dir --upgrade pip

# 2. Ставим ПРАВИЛЬНЫЕ версии для сборки madmom.
# Cython строго версии < 3.0. Обновляем numpy, чтобы он дружил со scipy.
RUN pip3 install --no-cache-dir "Cython==0.29.36" "numpy>=1.19.5" scipy

# 3. Копируем и ставим остальные зависимости
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

COPY . .

# --- Запуск приложения ---
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "5001"]