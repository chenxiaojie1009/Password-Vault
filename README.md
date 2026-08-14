# 🔐 设备管理器 (Device Manager)

内网设备账号密码管理工具 — 集中管理服务器、交换机、路由器等设备的账号密码，支持按设备分级权限、涉网管控、审计日志、备份还原。

## ✨ 功能

### 设备管理
- 🖥️ **设备管理** — 服务器 / 交换机 / 纵加设备 / 路由器 / 防火墙 / 存储设备 / 工作站 / 自定义
- 🌐 **多 IP / MAC** — 每个设备支持多个 IP 地址和 MAC 地址（可带标签）
- 🔴 **涉网管控** — 标记涉网设备，viewer/editor 无权查看，operator/admin 可查看
- 🔑 **密码加密** — 设备密码 Fernet 对称加密存储，可解密查看
- 📎 **文件附件** — 设备支持上传 Word/Excel/PDF/图片等附件，单文件 ≤100MB，跟随设备权限

### 权限体系（按设备分级）
| 角色 | 可创建等级 | 可查看等级 | 可编辑/删除等级 | 查看涉网 | 用户管理 | 系统配置 |
|------|-----------|-----------|---------------|---------|---------|---------|
| **管理员** admin | 一级~四级 | 全部 | 全部 | ✅ | ✅ | ✅ |
| **运维者** operator | 一级~三级 | 一级~三级 | 一级~三级 | ✅ | ❌ | ❌ |
| **编辑者** editor | 一级~二级 | 一级~二级 | 一级~二级 | ❌ | ❌ | ❌ |
| **查看者** viewer | 一级 | 一级 | 一级 | ❌ | ❌ | ❌ |

### 审计与历史
- 📜 **密码历史** — 记录变更时间、设备、账号、操作人、原因、**旧密码明文**
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
- 📱 **移动端适配** — PWA 支持，手机添加到主屏幕，小屏自动切换卡片布局；另有 **Android APK**（`android/` 目录）可打包安装
- 🕐 **北京时间** — 所有时间戳使用 UTC+8

### v2.0 在线升级（全新）
- 🚀 **一键升级** — 管理员在「系统升级」页面上传新版本升级包（zip：`DeviceManager.exe` + `version.json`），系统**自动备份数据**、替换程序文件并**自动重启**
- 💾 **数据零丢失** — 升级只替换程序文件，数据库 `device_manager.db` 与附件 `uploads/` 原样保留，旧程序自动存为备份
- 🔄 **升级流程** — 上传 → 确认升级 → 自动备份 → 替换 → 重启 → 页面自动恢复；升级前自动调用备份，可随时在「备份与还原」中回滚
- 📦 **示例升级包** — `deploy/upgrade_v2.0.0.zip` 即当前版本的升级包，可用于测试升级流程

## 🚀 快速开始

下载 `deploy` 文件夹到目标 Windows 机器，无需安装 Python：

```powershell
# 双击 启动.vbs（静默启动，无黑框）
# 浏览器自动打开 http://127.0.0.1:8000
```

> 默认管理员：`admin` / `admin123`（首次登录需修改密码）

> 首次启动自动创建 `device_manager.db`（SQLite），上传的附件存放在 `uploads/` 目录。

### 手机访问
1. 手机和电脑连同一 WiFi
2. 电脑 `ipconfig` 查看 IP（如 `192.168.1.5`）
3. 手机浏览器打开 `http://192.168.1.5:8000`
4. Chrome 可选"添加到主屏幕"→全屏运行

### 手机 APK（推荐）
1. 安装 `android/app/build/outputs/apk/release/DeviceManager-v2.0.0.apk`（或运行 `android\build_apk.bat` 自行打包）
2. 首次打开输入服务器地址，如 `http://192.168.1.5:8000`
3. 菜单可随时修改服务器地址 / 刷新 / 退出
4. 手机需与服务器处于同一局域网

## 🛠 技术栈

| 层 | 技术 |
|---|------|
| 后端 | Python FastAPI + SQLAlchemy + SQLite |
| 前端 | React 19 + TypeScript + Ant Design 5 |
| 认证 | JWT + bcrypt（用户密码）/ Fernet（设备密码） |
| 打包 | PyInstaller → 独立 EXE |
| 测试 | pytest（81 个测试用例） |

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
│   └── tests/                # 81 个测试用例
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
python -m pytest tests/ -v  # 81 passed
```

> 生产部署建议通过环境变量 `DM_SECRET_KEY` 覆盖默认 JWT/设备密码加密密钥。

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
