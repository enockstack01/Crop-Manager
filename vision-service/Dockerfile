# The fruit counter (Python and OpenCV), as its own small service. On Render: New > Web Service > this folder > Docker.
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY requirements-yolo.txt .
ARG WITH_YOLO=0
RUN if [ "$WITH_YOLO" = "1" ]; then pip install --no-cache-dir -r requirements-yolo.txt; fi
COPY . .
# the trained models are downloaded here on first use; hosts that run the container as a non-root user (Hugging Face Spaces) need it writable
RUN mkdir -p /app/models /tmp/yolo && chmod -R a+rwX /app/models /tmp/yolo
ENV YOLO_CONFIG_DIR=/tmp/yolo
ENV PORT=8090
EXPOSE 8090
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
