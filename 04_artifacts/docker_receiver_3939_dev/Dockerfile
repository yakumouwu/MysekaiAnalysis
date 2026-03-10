FROM python:3.11-slim

WORKDIR /app

COPY 01_scripts /app/01_scripts

RUN pip install --no-cache-dir -i https://mirrors.aliyun.com/pypi/simple/ --trusted-host mirrors.aliyun.com sssekai Pillow

ENV RECEIVER_PORT=3939
ENV API_REGION=cn
ENV PUBLIC_HOST=127.0.0.1
ENV OUTPUT_ROOT=/data

EXPOSE 3939

CMD ["python", "/app/01_scripts/import http.py"]
