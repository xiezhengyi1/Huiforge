# 绘域上线检查

## 1. 安装与启动

使用独立 Python 环境安装依赖，并通过进程管理器启动：

```bash
python -m pip install -r requirements-runtime.txt
python -m backend.huiju.core.preflight
python -m uvicorn backend.huiju.api.app:app --host 0.0.0.0 --port 8081 --workers 1 --proxy-headers
```

生产环境使用四个轻量入口进程和四个应用进程。入口直接从内存返回前端文件，依据会话稳定分流普通 API，并通过 SQLite WAL 原子批量记录访问统计；图像、视频、音频和代理任务固定到零号应用进程，保持内存任务状态和单 GPU 安全。`deploy/run_edge.sh` 与 `deploy/run_backend.sh` 将文件句柄提升到 65535，每个入口连接上限为 4096，为 1000 人同时在线保留足够余量。

静态 JS/CSS 使用发布号查询参数并返回一年不可变缓存；HTML 每次重验证，API 与私有媒体禁止缓存。公网代理负责 gzip/br 压缩，应用进程不重复压缩，避免占用单进程事件循环。访问统计只记录页面打开和写操作，健康检查、轮询与静态资源不得触发磁盘写入。

## 2. 必须配置

- 以 `deploy/production.env.example` 为键名模板，通过进程管理器或密钥服务注入，禁止提交真实密钥。
- 公网 HTTPS 环境设置 `RELAY_COOKIE_SECURE=1`。
- 设置 `HUIJU_PUBLIC_BASE_URL=https://你的公网域名`。所有带上传素材的视频模型都会得到一次性 HTTPS 素材地址；不能填写 `127.0.0.1`、Jupyter 地址或仅服务器内网可访问的地址。
- `BAILIAN_WAN3_BASE_URL` 默认沿用 `BAILIAN_BASE_URL`；只有百炼工作空间要求专用端点时才单独配置它。
- 配置 `HUIJU_ADMIN_USAGE_TOKEN`，保护模型用量后台。
- 默认运行数据位于 `var/`；生产环境可通过 `HUIJU_EDGE_STATS_DB` 与 `HUIJU_ANALYTICS_BACKUP_DIR` 改为外部持久化目录。
- 配置短信注册，以及至少一条图片、视频、音频服务线路。
- `requirements-runtime.txt` 内置 U2NetP Alpha 抠图运行时；首次使用会下载约 5MB 权重到运行账户缓存。生产镜像可在构建阶段预热该模型，避免用户第一次抠图等待下载。
- 持久化备份 `var/` 下的 SQLite 数据库、私有媒体、反馈目录和模型用量日志。

## 3. 反向代理

- 只向公网开放 HTTPS，代理到本机 `127.0.0.1:8081`。
- 保留原始 `Host`，并传递 `X-Forwarded-Proto`。
- 上传体积需不低于应用端配置；超时需覆盖最长模型请求时间。
- 不要把 `var/uploads`、`var/private-media`、数据库或环境文件设为静态目录。

## 4. 发布验证

```bash
python -m backend.huiju.core.preflight
curl -fsS https://your-domain/api/v1/health/live
curl -fsS https://your-domain/api/v1/health/ready
curl -fsSI https://your-domain/static/showcase/v167/skills/commercial-product.webp
python -m pytest -q
```

发布包必须包含完整的 `static/showcase` 目录。预检会解析首页、工作台及其脚本和样式中的全部版本化展示图引用，任一文件缺失或不是有效 WebP 都会以 `showcase_assets=false` 阻止启动。就绪探针与展示图请求必须返回 `200`，预检必须返回 `status=ready`。随后在三种主题下验证登录、图像、视频、音频、工作流、历史与资产的核心路径。

## 5. 回滚与备份

- 每次发布前备份数据库与私有媒体目录，并保留上一版源码和环境配置。
- 先在本机端口执行健康检查，再切换反向代理流量。
- 回滚时同时恢复匹配版本的数据库与私有媒体，避免记录指向不存在的文件。
- 每小时刷新当天的完整 SQLite 恢复点，跨日后保留为不可变的日终数据；默认保留 120 天。管理员数据台可手动创建恢复点并导出不含会话标识的 CSV/JSON。旧 JSON 统计与旧工作流格式不再迁移。
- 恢复前必须停止入口服务。先只校验快照：

```bash
python -m backend.huiju.persistence.analytics --source /workspace/huiju-api/shared/data/analytics-backups/edge-stats-YYYY-MM-DD.sqlite3
```

- 校验通过后，停服并显式确认离线恢复：

```bash
python -m backend.huiju.persistence.analytics \
  --source /workspace/huiju-api/shared/data/analytics-backups/edge-stats-YYYY-MM-DD.sqlite3 \
  --target /workspace/huiju-api/shared/data/edge-stats.sqlite3 \
  --apply --confirm-offline
```

- 应用前会额外保存一份 `pre-restore` 快照。

## 6. 当前容量边界

- 本地 GPU 生成并发为 1，等待队列为 8；这是显存隔离边界，不应通过增加 Uvicorn worker 绕过。
- “1000 人承载”指 1000 个同时在线连接，以及浏览、目录查询、额度查询等常规交互；不代表 1000 个本地生成任务并行执行。
- 单用户同时最多 1 个视频任务、2 个音频任务；API 模型任务的实际吞吐还受上游服务配额限制。
- Web 层可异步处理大量查询和静态请求；若持续连接逼近进程文件句柄上限，先在进程管理器提升 `nofile`，再考虑拆分静态资源服务。
- 横向扩容前，将任务队列、幂等键、限流窗口和临时上传状态迁移到 Redis/对象存储，并让 SQLite 升级为共享数据库。
