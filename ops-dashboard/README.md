# 绘域本地运营数据台

这个目录是独立的本地管理工具，不会作为绘域公开站点的静态资源发布。浏览器只连接 `127.0.0.1:8091`，本地代理通过 SSH 加密通道读取服务器的管理接口。

## 启动

双击 `start.cmd`，或在 PowerShell 中运行：

```powershell
.\start.ps1
```

首次连接时终端会要求输入服务器 SSH 密码；随后浏览器会自动打开。浏览器中再输入服务器配置的 `HUIJU_ADMIN_USAGE_TOKEN`。

- SSH 密码只交给当前 SSH 会话，不写入文件。
- 管理员 Token 只保存在当前浏览器标签页的 `sessionStorage` 中。
- 本地服务只监听回环地址，局域网中的其他设备无法访问。
- 关闭终端或按 `Ctrl+C` 即停止本地数据台。

如果已经有可直接访问的私有 HTTPS 地址，可以跳过 SSH：

```powershell
.\start.ps1 --upstream-url https://your-private-domain
```
