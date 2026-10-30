# Mysekai 地图查询插件

这个独立 Koishi 插件将 [钻石透视接收器](../docker_receiver_3939_dev/README_DOCKER.md) 的地图结果发送给已绑定的用户。它需要一个已有 Koishi 实例，启用 HTTP、SQLite 数据库服务及 OneBot 消息适配器。

## 安装与配置

将本目录作为本地 npm 包安装到已有 Koishi 项目，例如 `npm install /path/to/koishi_plugin_mysekai`，然后启用 `mysekai` 插件。设置：

| 配置项 | 用途 |
| --- | --- |
| `backendBaseUrl` | 当前 Koishi 实例可访问的接收器地址 |
| `backendApiKey` | 与接收器 `PLUGIN_API_KEY` 一致的查询密钥 |
| `queryCooldownSeconds` | 每用户查询间隔，默认 60 秒 |
| `requestTimeoutSeconds` | 后端请求超时，默认 45 秒 |
| `maxBindings` | 最大绑定数，默认 25 |
| `importBindingsPath` | 可选旧绑定导入文件，默认 `data/import-bindings.json` |

插件使用接收器 `/api/plugin/mysekai/map` 与 `/api/plugin/mysekai/file`，经配置的后端地址下载 PNG 后发送，不依赖接收器返回的公共域名。后端必须已经捕获对应玩家的完整 MySEKAI 数据。

## 命令

- `mysk ping`：检查插件。
- `mysk bind <游戏ID>`：绑定自己的游戏账号。
- `mysk unbind`、`mysk whoami`：解除或查询绑定。
- `mysk map`：查询四张地图。
- `mysk map site <5|6|7|8>`：查询单图。

同时接受 `/mysk`、`!mysk` 前缀；Koishi 的前缀配置需允许它们。非法参数不会回退为全图查询。游戏 ID 按字符串保存，绑定持久化至当前 Koishi 数据库；查询并发为 1。

旧绑定导入文件结构为 `{"bindings":{"<消息账号ID>":"<游戏ID>"}}`。仅导入不存在的绑定，完成后将文件改名为 `.imported`，避免重启覆盖用户之后的解绑。绑定文件和数据库属于私有运行数据。

## 测试

```bash
npm ci --ignore-scripts
npm test
```

测试使用虚构 ID 和临时 SQLite 数据库，覆盖参数校验、图片地址约束、绑定导入及重启持久化。
