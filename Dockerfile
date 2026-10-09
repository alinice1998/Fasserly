FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV TAFSIR_DB_PATH=/app/data/quran.db
ENV HOST=0.0.0.0
ENV PORT=8000

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY run_tafsir.py .

EXPOSE 8000

CMD ["python", "run_tafsir.py"]
