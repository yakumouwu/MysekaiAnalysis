FROM python:3.11-slim

WORKDIR /app

COPY ["dockerScripts/import http.py", "dockerScripts/render_mysekai_map.py", "/app/dockerScripts/"]
COPY dockerScripts/mysekai_assets /app/dockerScripts/mysekai_assets

RUN sed -i 's|http://deb.debian.org/debian|https://mirrors.aliyun.com/debian|g; s|http://deb.debian.org/debian-security|https://mirrors.aliyun.com/debian-security|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends fonts-noto-cjk ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN python -m pip install --no-cache-dir --no-deps \
    "pip @ https://files.pythonhosted.org/packages/3f/06/3e4420302363fbb71be3c7f35ce042f54bfca330e3e66b3a2e3c4cca579f/pip-26.2.2-py3-none-any.whl#sha256=fd7f4dfa8190e014013b9f08f3e973f4e4c26ffd179a204895533a7254813a70" \
    "certifi @ https://files.pythonhosted.org/packages/c4/51/29046e48f693c54e5b7412216d447a1d8362c9653148d98c02cdf65fa733/certifi-2026.10.19-py3-none-any.whl#sha256=42d35340cc5b9ba78e818ddbff0c5b1c2b779de448a340fd1b989f5fa8670e1b"

RUN pip install --no-cache-dir -i https://mirrors.aliyun.com/pypi/simple/ sssekai==0.7.62 Pillow

ENV RECEIVER_PORT=3939
ENV API_REGION=cn
ENV PUBLIC_HOST=127.0.0.1
ENV OUTPUT_ROOT=/data
ENV MYSEKAI_RESOURCE_MAP_JSON=/data/config/mysekai_resource_map.json
ENV BOT_PUSH_ENABLED=0
ENV BOT_MESSAGE_MODE=text+image
# Optional notifications use a separately configured OneBot HTTP endpoint.
ENV MYSEKAI_MAP_IMAGE_SIZE=1024
ENV MYSEKAI_ICON_SIZE=36
ENV MYSEKAI_COUNT_FONT_SIZE=18
ENV MYSEKAI_ICON_SPREAD=22
ENV TZ=Asia/Shanghai

EXPOSE 3939

CMD ["python", "/app/dockerScripts/import http.py"]

