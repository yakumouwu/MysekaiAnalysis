# MySEKAI 钻石透视接收器

[项目说明](../../README.md)

接收采集端转发的国服 MySEKAI 响应，使用 `sssekai==0.7.62` 解密，在四张地图上标注资源及钻石。该目录同时支持 Docker 与直接运行 Python。

## 构建与启动

在仓库根目录执行：

```bash
cp .env.example .env
# 填写 .env 中的 PUBLIC_HOST；地图查询鉴权使用自设 PLUGIN_API_KEY。
docker build -t mysekai-receiver:latest ./04_artifacts/docker_receiver_3939_dev
docker run -d --name mysekai-receiver --restart unless-stopped \
  --env-file .env -p 3939:3939 \
  -v mysekai-data:/data \
  -v "$PWD/01_scripts/mysekai_resource_map.json:/data/config/mysekai_resource_map.json:ro" \
  mysekai-receiver:latest
```

构建只复制接收器、地图渲染器和公开素材；`.dockerignore` 排除本地配置及运行数据。镜像更新系统 CA，并用 SHA-256 校验的 wheel 安装 pip 26.2.2、certifi 2026.10.19，保持 TLS 验证与 `sssekai` 版本锁定。修改 Dockerfile 或依赖后需要重建镜像。

`GET /healthz` 返回 `ok`；`GET /upload.js` 提供采集脚本；脚本将二进制响应及原始 URL 转发至接收器。`PUBLIC_HOST` 必须是采集设备可访问的主机名或 IP，不带协议和端口。`RECEIVER_PORT` 与实际端口映射必须对应。

## 核心参数

| 参数 | 用途 |
| --- | --- |
| `API_REGION=cn` | 国服解密区域 |
| `RECEIVER_PORT=3939` | 接收器监听端口 |
| `PUBLIC_HOST` | 采集脚本与查询图片地址使用的主机 |
| `OUTPUT_ROOT=/data` | 抓包、地图和日志的持久化目录 |
| `MYSEKAI_RESOURCE_MAP_JSON` | 资源名称/图标映射文件 |
| `RETENTION_COUNT=25` | 各类近期原始包、解密包及自动地图保留数量 |
| `PLUGIN_API_KEY` | 设置后，地图查询要求 `X-API-Key` |
| `PLUGIN_QUERY_IMAGE_RETENTION=25` | 查询地图图片保留数量 |
| `TZ=Asia/Shanghai` | 刷新窗口使用的服务器时区 |

根目录 `.env.example` 是公开占位配置，Docker 的 `--env-file` 负责加载它。本地 Python 不会自动读取 `.env`，需要自行设置进程环境变量。

## 钻石识别与地图

钻石为 `mysekai_material` 的 `id=12`。自动流程只接受完整数据包，按玩家、刷新窗口去重：`05:00–17:00` 和 `17:00–次日05:00`；同窗口仅首次钻石命中生成地图和触发可选通知。只渲染当前包中命中钻石的地图，多图分别生成，不拼接，也不使用历史图片兜底。

主动查询可以渲染没有钻石的完整包。站点为 5（初始空地）、6（心愿沙滩）、7（烂漫花田）、8（忘却之所）。`MYSEKAI_MAP_IMAGE_SIZE=1024` 表示单图目标宽度，保持底图比例。

图标相关参数：`MYSEKAI_ICON_SIZE=36`、`MYSEKAI_COUNT_FONT_SIZE=18`、`MYSEKAI_ICON_SPREAD=22`。增强参数为 `MYSEKAI_ICON_ENHANCE`、`MYSEKAI_ICON_SHARP_RADIUS`、`MYSEKAI_ICON_SHARP_PERCENT`、`MYSEKAI_ICON_SHARP_THRESHOLD`。

坐标采用固定原点投影。每张地图可配置 `SITE<id>_WORLD_HALF_X/Z`，再通过 `SITE<id>_SCALE_X/Z_DELTA`、`SITE<id>_OFFSET_X/Z_DELTA` 微调。标定时使用自己的数据，输出带不同文件名的对比图。

## 查询接口

- `GET /api/plugin/mysekai/map?mysekai_user_id=<游戏ID>`：查询全部地图。
- 增加 `site_id=<5|6|7|8>`：只查询一个站点。
- `GET /api/plugin/mysekai/file?name=<图片文件名>`：下载查询图片。
- 配置了 `PLUGIN_API_KEY` 时，地图查询需 `X-API-Key`；图片下载端点本身不校验该密钥。

成功响应包含 `text`、`images` 和 `source_json`。全图查询的 `text` 为空，单图查询为中文地图名。查询要求该玩家已有完整包。查询与自动通知共用一个渲染锁，避免并发渲染放大资源占用。

## 可选钻石通知

镜像和 `.env.example` 默认 `BOT_PUSH_ENABLED=0`。需要通知时设为 `1`，并配置独立 OneBot HTTP 服务：

- `BOT_PUSH_URL`：OneBot HTTP 基地址。
- `BOT_TOKEN`：对应鉴权令牌。
- `BOT_PUSH_MODE=private|group`、`BOT_TARGET_ID`：通知对象。
- `BOT_MESSAGE_MODE=text+image`：默认图文；图片失败后回退文字。
- `BOT_PUSH_RETRY=3`、`NOTIFICATION_USER_LABEL`：重试与显示名称。

同时检查 HTTP 状态和 OneBot `status`/`retcode`；HTTP 200 不等于发送成功。接收器与外部消息服务需网络互通。

去重及归档参数为 `NOTIFICATION_WINDOW_CACHE_HOURS=72`、`NOTIFICATION_HIT_RETENTION=100`、`NOTIFICATION_EVENT_RETENTION_LINES=5000`。持久化 `/data`，以保留去重状态；勿将该目录提交到 Git。
