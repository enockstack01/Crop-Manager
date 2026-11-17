# The fruit counter (Python and OpenCV), as its own small service. On Render: New > Web Service > this folder > Docker.
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PORT=8090
EXPOSE 8090
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
