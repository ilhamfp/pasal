FROM python:3.12-slim

WORKDIR /app

COPY agent/requirements.txt ./agent/requirements.txt
RUN pip install --no-cache-dir -r agent/requirements.txt

COPY . .

ENV PYTHONUNBUFFERED=1

CMD ["python", "-m", "agent.run_correction_agent"]
