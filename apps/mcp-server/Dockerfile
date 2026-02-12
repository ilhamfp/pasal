FROM python:3.12-slim
WORKDIR /app
COPY apps/mcp-server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY apps/mcp-server/ .
CMD ["python", "server.py"]
