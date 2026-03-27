# MCP / Skill 落地整理

## 目的

这份文档用于整理：
- 哪些 MCP 适合长期使用
- 哪些 skill 适合当前项目
- 先落地什么，后落地什么
- 每一项大概怎么接入

结论先说：
- 对你当前这套工作流，优先级最高的不是“多装”，而是“装了就真会用”
- 第一阶段建议先落地 1 个 MCP 和 2 个 skill
- 最适合当前项目的是：`docker` / `deploy-doc-sync` / `artifact-release`

## 当前已发现配置

- 已配置 MCP：
  - `ghidra`
- 当前可用系统 skill：
  - `openai-docs`
  - `skill-creator`
  - `skill-installer`

说明：
- `ghidra` 已写进本机 `config.toml`
- 但当前会话里没有读到可用资源，说明它现在还没真正连通

## 通用 MCP 推荐

### 1. filesystem

用途：
- 安全地读写项目文件
- 结构化浏览目录
- 适合做文档整理、批量检查、配置核对

适合度：
- 很高

建议：
- 如果后面有稳定的 filesystem MCP，可优先接入

### 2. git / github

用途：
- 看提交、分支、PR、issue
- 做发布、回滚、变更追踪

适合度：
- 很高

建议：
- 如果以后这个项目要拆成独立仓库，非常值得接入

### 3. docker

用途：
- 看容器、镜像、日志、挂载、网络
- 直接检查部署状态

适合度：
- 极高

为什么适合你：
- 你现在大量时间花在 build / run / 挂载 / 重建容器 / 看日志
- 这是最容易立刻提效的一项

### 4. browser / playwright

用途：
- 网页端检查
- 截图回归
- 自动验证页面流程

适合度：
- 中高

适合场景：
- LangBot 网页端联调
- 后续如果你常做前端验证，会很值

### 5. database

用途：
- 查 SQLite / MySQL / Postgres
- 直接定位绑定关系、缓存、日志数据

适合度：
- 中

适合场景：
- 如果后面插件绑定、查询缓存、审计日志进数据库，就很有用

## 通用 Skill 推荐

### 1. deploy-doc-sync

用途：
- 改完脚本后自动提醒同步：
  - Docker 文档
  - README
  - TODO
- 检查敏感信息是否误写进文档

适合度：
- 极高

原因：
- 这正好是你现在反复在做的事
- 而且你已经有明确规则了，最适合固化成 skill

### 2. artifact-release

用途：
- 打 tar
- 生成上传命令
- 输出服务器重建步骤

适合度：
- 很高

原因：
- 你现在经常在“本地改 -> 打包 -> 传服务器 -> 重建”
- 这是非常标准、非常可模板化的一段流程

### 3. docker-deploy

用途：
- 输出 build / run / logs / verify 的完整步骤
- 区分“要不要重建镜像”

适合度：
- 很高

原因：
- 现在项目的主要运维复杂度就在这里

### 4. repo-onboarding

用途：
- 快速解释一个仓库结构
- 输出关键目录、启动方式、风险点

适合度：
- 中高

适合场景：
- 后面你再接别的项目时很省时间

### 5. api-debug

用途：
- 固化接口调试步骤
- 输出最小验证命令
- 检查鉴权、参数、返回结构

适合度：
- 中高

适合场景：
- 当前插件和 receiver 联调

## 针对当前项目的推荐优先级

### 第一阶段：建议立即做

1. `docker` MCP
2. `deploy-doc-sync` skill
3. `artifact-release` skill

原因：
- 都是你现在最高频的动作
- 落地后能立刻减少重复沟通和重复命令

### 第二阶段：可以后做

1. `git / github` MCP
2. `docker-deploy` skill
3. `api-debug` skill

### 第三阶段：按需再做

1. `browser / playwright` MCP
2. `database` MCP
3. `repo-onboarding` skill

## 建议落地方式

### A. 先修通现有 ghidra MCP

目标：
- 确认它是否真的能提供资源

建议动作：
- 检查本地 Ghidra MCP 服务是否启动
- 检查 `localhost:8765` 是否可访问
- 再看 Codex 会话是否能列出资源

说明：
- 现有配置别急着删
- 先判断是“服务没启动”还是“当前会话没接上”

### B. 新建 skill：deploy-doc-sync

建议内容：
- 改完脚本后检查：
  - `00_docs/TODO.md`
  - `README.md`
  - `README.zh-CN.md`
  - Docker 文档
- 检查 README 中是否出现：
  - 真实 token
  - 真实群号/QQ 号
  - 真实公网 IP
- 只保留关键点，不展开过细说明

### C. 新建 skill：artifact-release

建议内容：
- 生成 tar 包
- 输出 `scp` 命令
- 输出服务器侧：
  - 解压
  - 是否需要 build
  - 是否只需重建容器
  - 验证命令

### D. 之后再考虑 docker MCP

目标：
- 直接查询容器状态、镜像、日志、挂载和端口

价值：
- 会比现在反复手打 `docker ps` / `docker inspect` / `docker logs` 更顺手

## 一个现实建议

如果只允许你现在先做一件事，我建议不是先折腾很多 MCP，而是：

1. 先把 `deploy-doc-sync` skill 做出来

原因：
- 它和你当前项目最贴近
- 没有额外服务依赖
- 成本低，收益马上可见

如果允许做两件事：

1. `deploy-doc-sync`
2. `artifact-release`

如果允许做三件事：

1. `deploy-doc-sync`
2. `artifact-release`
3. 修通 `ghidra` MCP 或补一个 `docker` MCP

## 下一步建议

建议按这个顺序推进：

1. 先检查 `ghidra` MCP 为什么当前不可用
2. 然后创建 `deploy-doc-sync` skill
3. 再创建 `artifact-release` skill

这样推进最稳，也最符合你现在的工作重心。
