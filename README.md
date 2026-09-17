# 🔐 设备管理器 (Device Manager)

内网设备账号密码管理工具 — 集中管理服务器、交换机、路由器等设备的账号密码，支持按设备分级权限、涉网管控、审计日志、备份还原。

## 📥 下载

最新版 Windows 程序与 Android APK 见 **[Releases](https://github.com/chenxiaojie1009/Password-Vault/releases/latest)**：

- `DeviceManager.exe` — Windows 独立可执行文件（免安装 Python）
- `DeviceManager-v4.0.apk` — Android 客户端（v4.0 换了发布签名，需先卸载旧版再安装）
- `version.json` — 版本信息，自建在线升级包时与 `DeviceManager.exe` 一起打 zip

## ✨ 功能

### 设备管理
- 🖥️ **设备管理** — 服务器 / 交换机 / 纵加设备 / 路由器 / 防火墙 / 存储设备 / 工作站 / 自定义
- 🌐 **多 IP / MAC** — 每个设备支持多个 IP 地址和 MAC 地址（可带标签）
- 🔴 **涉网管控** — 标记涉网设备，viewer/editor 无权查看，operator/admin 可查看
- 🔑 **密码加密与按需解密** — 设备密码和密码历史均以 Fernet 加密存储；常规接口不返回密码，只有 admin/operator 通过设备等级与涉网权限校验后才能按单条查看
- 📎 **文件附件** — 设备支持上传压缩包/Word/Excel/PPT/PDF/图片/文本等附件，单文件 ≤100MB，跟随设备权限

### 权限体系（按设备分级）
| 角色 | 可创建等级 | 可查看等级 | 可编辑/删除等级 | 查看涉网 | 用户管理 | 系统配置 |
|------|-----------|-----------|---------------|---------|---------|---------|
| **管理员** admin | 一级~四级 | 全部 | 全部 | ✅ | ✅ | ✅ |
| **运维者** operator | 一级~三级 | 一级~三级 | 一级~三级 | ✅ | ❌ | ❌ |
| **编辑者** editor | 一级~二级 | 一级~二级 | 一级~二级 | ❌ | ❌ | ❌ |
| **查看者** viewer | 一级 | 一级 | 一级 | ❌ | ❌ | ❌ |

### 审计与历史
- 📜 **密码历史** — 记录变更时间、设备、账号、操作人、原因；旧密码加密留档并按权限单独解密
- 📝 **审计日志** — 登录/增删改/导出/导入 全部记录可追溯
- 📊 **Excel 导出** — 含涉网标记列，支持合并导出（密码+用户双 Sheet）
- 📥 **批量导入** — 设备/用户均可 Excel 批量导入

### 备份与还原
- 💾 **自动备份** — 每天凌晨 2:00，保留最近 30 份，旧备自动清理；备份同时打包附件
- 📦 **手动备份** — Web 页面一键备份，下载到本地
- 🔄 **上传还原** — 上传 .db 备份文件，还原前自动备份当前数据
- 📁 **历史管理** — 查看/还原/下载所有历史备份

### 其他
- 📊 **数据概览** — 首页仪表盘：设备/账号/用户/今日操作统计 + 类型分布 + 最近活动（管理员可见）
- 🔒 **首次改密** — 新用户首次登录强制修改默认密码
- 🛡️ **密码强度** — 5 维度评分（长度/大小写/数字/特殊字符），修改密码时实时显示强度条
- 🎨 **界面与动效**（v2.1.3）— 玻璃拟态视觉 + 渐变主题，侧边栏选中动效、面包屑、`Ctrl+K` 快速跳转、移动端抽屉导航；数据概览含环形类型分布图与操作动态流；设备列表支持**表格 / 卡片**双视图一键切换
- 📱 **移动端适配** — PWA 支持，手机添加到主屏幕，小屏自动切换卡片布局；另有 **Android APK**（`android/` 目录）可打包安装
- 🕐 **北京时间** — 所有时间戳使用 UTC+8

### v4.0 安全加固（全新）
- 🔑 **密钥自动生成** — 首次启动在程序目录生成唯一加密密钥 `secret.key`（环境变量 `DM_SECRET_KEY` 优先），不再使用硬编码默认密钥；请单独备份该文件
- 🔒 **局域网自动 HTTPS** — 首次启动自动生成自签名证书（`tls.crt` / `tls.key`），同端口双监听：`127.0.0.1` 明文 HTTP 供桌面、局域网 IP 走 HTTPS 供手机；局域网明文 API 请求返回 `426`
- 👁️ **密码按需解密** — 设备密码与历史密码不再随列表接口返回，改为单条授权接口（`/api/accounts/{id}/password`、`/api/password-history/{id}/password`）实时解密，仅 admin/operator 且通过等级与涉网校验后可查看
- 🧹 **历史数据迁移** — 旧版本以明文留存的历史密码在服务首次启动时自动加密
- 🧱 **跨域收敛** — CORS 不再放通任意来源，仅保留必要的方法与请求头
- 📱 **Android 强制 HTTPS** — APK 禁用明文流量与混合内容，服务器地址自动规范化为 `https://` 并补默认端口；自签名证书首次连接按 SHA-256 指纹确认后记住（TOFU）

> 升级到 v4.0：首次启动会自动生成 `secret.key`，请与数据库分开备份；局域网/手机访问仍需先配置 TLS 证书。若旧库中的设备密码是用旧版硬编码密钥加密的，可临时用 `DM_SECRET_KEY=device-manager-secret-change-in-production` 启动以继续解密（随后请尽快改为本机唯一密钥）。

### v2.0 在线升级（全新）
- 🚀 **一键升级** — 管理员在「系统升级」页面上传新版本升级包（zip：`DeviceManager.exe` + `version.json`），系统**自动备份数据**、替换程序文件并**自动重启**
- 💾 **数据零丢失** — 升级只替换程序文件，数据库 `device_manager.db` 与附件 `uploads/` 原样保留，旧程序自动存为备份
- 🔄 **升级流程** — 上传 → 确认升级 → 自动备份 → 替换 → 重启 → 页面自动恢复；升级前自动调用备份，可随时在「备份与还原」中回滚
- 📦 **升级包格式** — 把 `DeviceManager.exe` 与 `version.json`（含 `version` / `changelog`）打成 zip 即可上传升级；为保持仓库精简，仓库内不再附带历史升级包，需要时用当前版本自行打包

## 🚀 快速开始

下载 `deploy` 文件夹到目标 Windows 机器，无需安装 Python：

```powershell
# 双击 启动.vbs（静默启动，无黑框）
# 浏览器自动打开 http://127.0.0.1:8000
```

> 首次启动会在程序目录自动生成 `secret.key`（本机唯一的 JWT / 设备密码加密密钥），并弹窗提示一次。**请把 `secret.key` 与数据库分开备份**；丢失后已加密的设备密码将无法解密。需要自定义密钥时，用环境变量 `DM_SECRET_KEY` 覆盖即可（优先级最高）。

> 默认管理员：`admin` / `admin123`（首次登录需修改密码）

> 首次启动自动创建 `device_manager.db`（SQLite），上传的附件存放在 `uploads/` 目录。

### 手机 / 局域网访问（v4.0 起自动 HTTPS）
1. 手机和电脑连同一 WiFi（手机需能访问本机，Windows 网络为「公用」时默认不拦）
2. 启动程序：首次启动会弹窗给出**局域网地址**（形如 `https://192.168.1.132:8000`）与**证书 SHA-256 指纹**，同时写进 `server.log`
3. 手机安装 APK，服务器地址填该地址（只填 IP 也会自动补 `:8000`）
4. 首次连接会提示「服务器证书未受信任」：核对指纹后点「信任并继续」，之后同一张证书不再提示
5. 桌面端不受影响，继续用 `http://127.0.0.1:8000`（回环明文，浏览器不会弹证书警告）

同一端口上双监听：`127.0.0.1:8000` 走明文 HTTP（只有本机能连，供桌面使用），`0.0.0.0:8000` 走 HTTPS（供局域网/手机）。局域网里不存在明文密码与 JWT 的落点。

自签名证书由程序首次启动自动生成到程序目录（`tls.crt` / `tls.key`），SAN 覆盖本机所有 IPv4、`127.0.0.1`、`::1`、`localhost` 与主机名，有效期 10 年；本机 IP 变化时自动重签（手机会再确认一次）。也可用自有证书覆盖：

```powershell
# 可选：覆盖自动生成的密钥与证书（不设置则用程序目录的 secret.key / tls.crt）
$env:DM_SECRET_KEY = "请使用密码管理器生成的长随机值"
$env:DM_TLS_CERT_FILE = "C:\certs\device-manager.crt"
$env:DM_TLS_KEY_FILE = "C:\certs\device-manager.key"
$env:DM_TLS_PORT = "8000"   # 可选：HTTPS 监听端口，默认与 DM_PORT 相同
.\DeviceManager.exe
```

把这些文件与数据库分开保管：`secret.key` 丢了设备密码解不开，`tls.key` 丢了手机会重新提示信任。旧版本遗留的密码历史会在服务首次启动时自动加密迁移。

### 手机 APK（推荐）
1. 安装 `deploy/DeviceManager-v4.0.apk`（或运行 `android\build_apk.bat` 自行打包，版本号见 `android/version.properties`）
2. 每次打开先确认服务器地址（可修改），如 `https://192.168.1.132:8000`
3. 菜单可随时修改服务器地址 / 刷新 / 退出（退出需二次确认）
4. 手机需与服务器处于同一局域网
5. 自签名证书首次连接时按指纹确认一次；APK 记住该主机的证书指纹（TOFU），证书更换时会再次提示
6. v4.0 起 APK 使用发布密钥库 `android/device-manager.keystore`（别名 `devicemanager`）签名；**该密钥库与密码必须妥善备份**，后续版本只有用同一密钥库签名才能覆盖安装

## 🛠 技术栈

| 层 | 技术 |
|---|------|
| 后端 | Python FastAPI + SQLAlchemy + SQLite |
| 前端 | React 19 + TypeScript + Ant Design 5 |
| 认证 | HTTPS + JWT + bcrypt（用户密码）/ Fernet（设备密码与历史） |
| 打包 | PyInstaller → 独立 EXE |
| 测试 | pytest（92 个测试用例） |

## 📁 项目结构

```
device-manager/
├── backend/
│   ├── main.py              # FastAPI 后端（43 个端点）
│   ├── models.py             # 10 张数据库表
│   ├── schemas.py            # Pydantic 模型
│   ├── auth.py               # JWT + bcrypt + Fernet
│   ├── database.py           # SQLite 配置
│   ├── requirements.txt      # Python 依赖
│   ├── uploads/              # 设备附件存储目录
│   └── tests/                # 92 个测试用例
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.tsx           # 登录 + 首次改密
│   │   │   ├── Dashboard.tsx       # 数据概览仪表盘（首页）
│   │   │   ├── DeviceList.tsx      # 设备列表（表格/卡片）
│   │   │   ├── DeviceForm.tsx      # 添加/编辑设备（含文件上传）
│   │   │   ├── PasswordHistory.tsx # 密码历史（含旧密码）
│   │   │   ├── AuditLog.tsx        # 审计日志
│   │   │   ├── UserManagement.tsx  # 用户管理（导入/导出）
│   │   │   └── BackupRestore.tsx   # 备份与还原
│   │   ├── components/       # AppLayout, DeviceModal, PasswordStrengthMeter
│   │   └── api/              # Axios 封装
│   └── public/               # icon.png, manifest.json
└── deploy/                   # 一键部署包
    ├── DeviceManager.exe     # 独立可执行文件
    ├── 启动.vbs               # 静默启动脚本
    └── backups/              # 自动备份目录
```

## 🔧 开发

```bash
# 后端
cd backend
pip install -r requirements.txt
python main.py              # → http://localhost:8000

# 前端
cd frontend
npm install
npm run dev                 # → http://localhost:3000

# 测试
cd backend
python -m pytest tests/ -v  # 92 passed
```

> 运行时必须通过环境变量 `DM_SECRET_KEY` 提供唯一的 JWT/设备密码加密密钥；为局域网访问同时配置 `DM_TLS_CERT_FILE` 与 `DM_TLS_KEY_FILE`。缺少 TLS 时仅允许本机回环访问。

## 📦 打包

```bash
cd frontend && npm run build
Copy-Item -Recurse dist\* ..\backend\frontend-dist\
cd ..\backend
pyinstaller DeviceManager.spec
# → dist/DeviceManager.exe
```

## 🔑 API 概览

### 认证
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录（返回 JWT） |
| POST | `/api/auth/change-password` | 修改密码 |

### 设备
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/devices` | 设备列表（按角色等级+涉网过滤） |
| POST | `/api/devices` | 创建设备 |
| PUT | `/api/devices/{id}` | 更新设备 |
| DELETE | `/api/devices/{id}` | 删除设备 |

### 文件
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/devices/{id}/files` | 查看设备文件列表 |
| POST | `/api/devices/{id}/files` | 上传文件（多文件） |
| GET | `/api/files/{id}/download` | 下载文件 |
| DELETE | `/api/files/{id}` | 删除文件 |

### 导出/导入
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/export` | 导出设备列表 |
| POST | `/api/export/all` | 合并导出（密码+用户双sheet） |
| POST | `/api/import/xlsx` | 批量导入设备 |
| POST | `/api/users/import` | 批量导入用户 |

### 历史/审计
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/password-history` | 密码历史（权限过滤） |
| GET | `/api/audit-logs` | 审计日志（支持用户名/操作/日期筛选，返回 X-Total-Count） |
| GET | `/api/dashboard` | 数据概览统计（按角色过滤 + 最近活动） |

### 备份与还原
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/backups` | 备份列表 |
| POST | `/api/backups` | 手动备份 |
| GET | `/api/backups/download/{name}` | 下载备份 |
| POST | `/api/backups/restore` | 上传还原 |
| POST | `/api/backups/{name}/restore` | 历史还原 |

### 用户/配置
| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/users` | 用户管理 |
| PUT | `/api/users/{id}` | 更新用户 |
| DELETE | `/api/users/{id}` | 删除用户 |
| GET/POST/DELETE | `/api/config/{key}` | 自定义设备类型/角色 |

### 在线升级（v2.0）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/upgrade/info` | 当前版本 / 待升级包 / 升级状态（管理员） |
| POST | `/api/upgrade/upload` | 上传升级包 zip（DeviceManager.exe + version.json） |
| POST | `/api/upgrade/apply` | 应用升级：自动备份 → 替换 exe → 自动重启 |
| POST | `/api/upgrade/cancel` | 取消待应用的升级包 |

## 📄 License

MIT
