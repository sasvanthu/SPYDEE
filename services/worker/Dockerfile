FROM python:3.12-slim
WORKDIR /app
COPY services/worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY services/worker/ ./app/
COPY services/api/app/config.py ./app/config.py
COPY services/api/app/models/ ./app/models/
COPY services/api/app/services/ ./app/services/
COPY analysis/ ./analysis/
COPY demo/ ./demo/
CMD ["python", "-m", "app.main"]
