FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libgomp1 libxrender1 libsm6 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY cad/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY cad/ ./
RUN useradd -m converter && mkdir /jobs && chown converter /jobs
USER converter
ENV JOB_ROOT=/jobs PYTHONUNBUFFERED=1 HOST=0.0.0.0
EXPOSE 8080
CMD ["python", "server.py"]
