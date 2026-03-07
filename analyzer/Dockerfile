# --- Базовый образ с Essentia ---
    # Используем официальный образ Essentia для максимальной совместимости
    FROM ghcr.io/mtg/essentia:latest

    # --- Установка дополнительных системных зависимостей ---
    # Essentia уже включает все необходимые библиотеки, но добавим Flask зависимости
    RUN apt-get update && apt-get install -y --no-install-recommends \
        python3-pip \
        && rm -rf /var/lib/apt/lists/*
    
    # --- Настройка рабочей директории ---
    WORKDIR /app
    
    # --- Копирование и установка Python-зависимостей ---
    COPY requirements.txt .
    RUN pip3 install --no-cache-dir -r requirements.txt
    
    # --- Копирование кода приложения ---
    COPY . .
    
    # --- Запуск приложения ---
    # Используем gunicorn - это продакшн-сервер.
    CMD ["gunicorn", "--bind", "0.0.0.0:8000", "app:app"]