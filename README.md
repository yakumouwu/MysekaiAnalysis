# MysekaiAnalysis

为国服 Project SEKAI（《初音未来：缤纷舞台》）MySEKAI 建立的钻石透视辅助插件。解析游戏已下发的资源数据，在地图上标出钻石等采集物的位置，并提供地图查询和可选通知。

## 工作流程

```text
游戏的 mysekai 响应 → Shadowrocket 转发 → Python 接收与解密
                                        ↓
                           识别钻石 → 渲染地图 → 查询 / 可选通知
```

钻石对应 `resourceType=mysekai_material`、`resourceId=12`。分析结果来自当前捕获的数据；没有完整数据包时无法查询对应玩家的地图。

## 功能

- 支持初始空地（5）、心愿沙滩（6）、烂漫花田（7）、忘却之所（8）。
- 在底图标注资源位置、种类和数量，支持重叠图标与站点坐标校准。
- 自动处理只在完整包确认有钻石时渲染，且只生成包含钻石的地图；多张地图分别输出。
- 按玩家在每天 `05:00–17:00`、`17:00–次日05:00` 两个窗口去重，同一窗口仅首次命中生成地图并触发通知。
- 提供单图或全图查询接口；主动查询不要求包内有钻石，但必须已有该玩家的完整数据包。
- 可选通过 OneBot HTTP 接口发送群聊或私聊通知，图片发送失败时回退为文字。
- 提供独立的 [Koishi Mysekai 查询插件](./04_artifacts/koishi_plugin_mysekai/README.md)，用于账号绑定和 `mysk map` 查询。

## 快速开始

推荐使用 [接收器 Docker 说明](./04_artifacts/docker_receiver_3939_dev/README_DOCKER.md)。在仓库根目录执行：

```bash
cp .env.example .env
# 编辑 .env：填写 PUBLIC_HOST；需要保护地图查询时设置 PLUGIN_API_KEY。
docker build -t mysekai-receiver:latest ./04_artifacts/docker_receiver_3939_dev
docker run -d --name mysekai-receiver --restart unless-stopped \
  --env-file .env -p 3939:3939 \
  -v mysekai-data:/data \
  -v "$PWD/01_scripts/mysekai_resource_map.json:/data/config/mysekai_resource_map.json:ro" \
  mysekai-receiver:latest
```

`PUBLIC_HOST` 填接收器可达的主机名或 IP，不带协议或端口。示例默认关闭消息推送，先验证地图分析链路。

### 配置采集端

在 Shadowrocket 中匹配国服 `/api/user/<游戏ID>/mysekai` 的响应，启用响应体读取及适合二进制响应的处理模式，脚本地址填：

```text
http://<接收器地址>:3939/upload.js
```

打开游戏并进入 MySEKAI，使游戏下发完整资源数据。接收器将保存原始包、解密 JSON，并在首次钻石命中时生成对应地图。`GET /healthz` 返回 `ok` 只代表接收器存活，不代表已经捕获游戏数据。

### 本地运行

需要 Python 3.11+。安装依赖后，设置 `API_REGION=cn`、`PUBLIC_HOST`、`OUTPUT_ROOT` 和 `MYSEKAI_RESOURCE_MAP_JSON`，再运行同一接收器：

```bash
python -m pip install -r requirements.txt
API_REGION=cn PUBLIC_HOST=127.0.0.1 OUTPUT_ROOT=./02_captures \
  MYSEKAI_RESOURCE_MAP_JSON=./01_scripts/mysekai_resource_map.json BOT_PUSH_ENABLED=0 \
  python "04_artifacts/docker_receiver_3939_dev/dockerScripts/import http.py"
```

以上环境变量写法适用于 Bash；PowerShell 使用 `$env:变量名='值'` 分别设置。默认端口为 3939；其他设备采集时应将 `PUBLIC_HOST` 改为其可访问的地址。依赖 `sssekai` 固定为 **0.7.62**。

## 输出与查询

相对于 `OUTPUT_ROOT`：

| 路径 | 内容 |
| --- | --- |
| `raw_api/mysekai/` | 原始响应 |
| `decoded_api/mysekai/` | 解密后的 JSON |
| `decoded_api/mysekai/maps/` | 自动生成的地图 |
| `notifications/` | 去重缓存、命中归档与通知事件 |
| `logs/receiver.log` | 接收与分析日志 |

地图查询使用 `GET /api/plugin/mysekai/map?mysekai_user_id=<游戏ID>`，增加 `site_id=6` 可只查询心愿沙滩。设置 `PLUGIN_API_KEY` 后携带请求头 `X-API-Key`。返回的 `images` 包含图片地址，`source_json` 标识本次使用的完整数据包。通过 `/api/plugin/mysekai/file?name=<文件名>` 下载查询图片。

## 目录

- `04_artifacts/docker_receiver_3939_dev/`：数据接收、解密、钻石识别、地图渲染及公开素材。
- `04_artifacts/koishi_plugin_mysekai/`：可选的 Mysekai 地图查询插件。
- `01_scripts/mysekai_resource_map.json`：资源名称与图标映射。
- `tests/`：识别、去重、推送和 HTTP 接口测试。

## 验证与排查

```bash
python -m unittest discover -s tests -p 'test_*.py' -v
```

- 没有地图：确认采集到了完整 `mysekai` 包；自动处理还要求本窗口首次钻石命中。
- 同窗口再次进入没有新图：这是去重规则；需要查看时可主动查询地图接口。
- 标记位置不对：检查 `SITE<id>_WORLD_HALF_X/Z`、`SITE<id>_SCALE_X/Z_DELTA`、`SITE<id>_OFFSET_X/Z_DELTA`，详见接收器说明。
- 查询返回无数据或鉴权失败：检查游戏 ID、完整包及 `X-API-Key`；图片地址不可达时检查 `PUBLIC_HOST` 和端口。

仓库只发布源码、公开地图素材与占位配置。个人抓包、账号绑定、日志、数据库、令牌和部署环境保存在本地，勿提交。
