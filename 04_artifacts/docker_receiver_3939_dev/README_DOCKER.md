# Mysekai/Suite Receiver Docker (Port 3939)
[中文](./README_DOCKER.zh-CN.md) | [Project README](../../README.md) | [项目中文总览](../../README.zh-CN.md)

## Build

```bash
docker build -t pjsk-receiver:latest .
```

## Run

Notes:
- Receiver and NapCat must be in the same Docker network: `docker network create <YOUR_DOCKER_NETWORK>`.
- IDs and tokens below are placeholders. Replace them in your own environment.

```bash
docker run -d \
  --name pjsk-receiver \
  --network <YOUR_DOCKER_NETWORK> \
  --restart=always \
  --log-driver=json-file \
  --log-opt max-size=20m \
  --log-opt max-file=5 \
  -p 3939:3939 \
  -e PUBLIC_HOST=<YOUR_SERVER_PUBLIC_IP_OR_DOMAIN> \
  -e RECEIVER_PORT=3939 \
  -e API_REGION=cn \
  -e OUTPUT_ROOT=/data \
  -e MYSEKAI_RESOURCE_MAP_JSON=/data/config/mysekai_resource_map.json \
  -e RETENTION_COUNT=25 \
  -e BOT_PUSH_ENABLED=1 \
  -e BOT_PUSH_URL=http://napcat:3000 \
  -e BOT_TOKEN=<YOUR_NAPCAT_HTTP_TOKEN> \
  -e BOT_PUSH_MODE=<private_or_group> \
  -e BOT_TARGET_ID=<YOUR_QQ_OR_GROUP_ID> \
  -e NOTIFICATION_USER_LABEL=<YOUR_USER_LABEL> \
  -e BOT_PUSH_RETRY=3 \
  -e BOT_MESSAGE_MODE=text+image \
  -e PLUGIN_API_KEY=<OPTIONAL_PLUGIN_API_KEY> \
  -e PLUGIN_QUERY_IMAGE_RETENTION=25 \
  -e MYSEKAI_MAP_IMAGE_SIZE=1024 \
  -e MYSEKAI_ICON_SIZE=36 \
  -e MYSEKAI_COUNT_FONT_SIZE=18 \
  -e MYSEKAI_ICON_SPREAD=22 \
  -e NOTIFICATION_WINDOW_CACHE_HOURS=72 \
  -e NOTIFICATION_HIT_RETENTION=100 \
  -e NOTIFICATION_EVENT_RETENTION_LINES=5000 \
  -e TZ=Asia/Shanghai \
  -v /opt/pjsk-captures:/data \
  -v /opt/pjsk-config:/data/config \
  -v /opt/docker_receiver_3939_dev/dockerScripts:/app/dockerScripts \
  pjsk-receiver:latest
```

Quick checks after start:

```bash
docker logs -n 80 pjsk-receiver
docker exec -it pjsk-receiver python -m pip show sssekai
curl -sS http://127.0.0.1:3939/healthz
```

Connectivity check from `langbot`:

```bash
docker exec -it langbot python -c "import urllib.request;print(urllib.request.urlopen('http://pjsk-receiver-dev:3939/healthz',timeout=5).read().decode())"
docker exec -it langbot python -c "import urllib.request;print(urllib.request.urlopen('http://pjsk-receiver-dev:3939/api/plugin/mysekai/map?mysekai_user_id=<YOUR_MYSEKAI_USER_ID>&requester_qq=123456',timeout=20).read().decode())"
```

## Container Paths

- raw data: `/data/raw_api/...`
- decoded json: `/data/decoded_api/...`
- mysekai images: `/data/decoded_api/mysekai/maps/...`
- logs: `/data/logs/receiver.log`
- notification hits: `/data/notifications/hits/`
- notification events: `/data/notifications/diamond_notifications.jsonl`

## Render Parameters

- `MYSEKAI_MAP_IMAGE_SIZE`: output width
- `MYSEKAI_ICON_SIZE`: icon size
- `MYSEKAI_COUNT_FONT_SIZE`: count text size
- `MYSEKAI_ICON_SPREAD`: spread radius for multi-resource points
- `MYSEKAI_IGNORE_BASE_MATERIALS`: whether to hide base materials on the same coordinate

## Plugin Query API

- optional auth header: `X-API-Key`
- query params:
  - `mysekai_user_id`
  - `requester_qq`
  - `site_id` (`5,6,7,8`)
- success response:
  - `{ "ok": true, "message": "ok", "data": { "text": "...", "images": ["http://..."] } }`

## NapCat API Baseline

- `POST {BOT_PUSH_URL}/send_private_msg`
- `POST {BOT_PUSH_URL}/send_group_msg`
