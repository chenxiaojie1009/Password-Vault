# 🔐 设备管理器 (Device Manager)

内网设备账号密码管理工具 — 集中管理服务器、交换机、路由器等设备的账号密码，支持四级权限、涉网管控、审计日志、备份还原。

## ✨ 功能

### 设备管理
- 🖥️ **设备管理** — 服务器 / 交换机 / 纵加设备 / 路由器 / 防火墙 / 存储设备 / 工作站 / 自定义
- 🌐 **多 IP / MAC** — 每个设备支持多个 IP 地址和 MAC 地址（可带标签）
- 🔴 **涉网管控** — 标记涉网设备，viewer/editor 无权查看，operator/admin 可查看
- 🔑 **密码加密** — 设备密码 Fernet 对称加密存储，可解密查看

### 权限体系（四级）
| 角色 | 查看非涉网 | 编辑非涉网 | 查看涉网 | 编辑涉网 | 用户管理 | 系统配置 |
|------|-----------|-----------|---------|---------|---------|---------|
| **管理员** admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **运维者** operator | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **编辑者** editor | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **查看者** viewer | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### 审计与历史
- 📜 **密码历史** — 记录变更时间、设备、账号、操作人、原因、**旧密码明文**
- 📝 **审计日志** — 登录/增删改/导出/导入 全部记录可追溯
- 📊 **Excel 导出** — 含涉网标记列，支持合并导出（密码+用户双 Sheet）
- 📥 **批量导入** — 设备/用户均可 Excel 批量导入

### 备份与还原
- 💾 **自动备份** — 每天凌晨 2:00，保留最近 30 份，旧备自动清理
- 📦 **手动备份** — Web 页面一键备份，下载到本地
- 🔄 **上传还原** — 上传 .db 备份文件，还原前自动备份当前数据
- 📁 **历史管理** — 查看/还原/下载所有历史备份

### 其他
- 🔒 **首次改密** — 新用户首次登录强制修改默认密码
- 🛡️ **密码强度** — 5 维度评分（长度/大小写/数字/特殊字符）
- 📱 **移动端适配** — PWA 支持，手机添加到主屏幕，小屏自动切换卡片布局
- 🕐 **北京时间** — 所有时间戳使用 UTC+8

## 🚀 快速开始

下载 `deploy` 文件夹到目标 Windows 机器，无需安装 Python：

```powershell
# 双击 启动.vbs（静默启动，无黑框）
# 浏览器自动打开 http://127.0.0.1:8000
```

> 默认管理员：`admin` / `admin123`（首次登录需修改密码）

### 手机访问
1. 手机和电脑连同一 WiFi
2. 电脑 `ipconfig` 查看 IP（如 `192.168.1.5`）
3. 手机浏览器打开 `http://192.168.1.5:8000`
4. Chrome 可选"添加到主屏幕"→全屏运行

## 🛠 技术栈

| 层 | 技术 |
|---|------|
| 后端 | Python FastAPI + SQLAlchemy + SQLite |
| 前端 | React 19 + TypeScript + Ant Design 5 |
| 认证 | JWT + bcrypt（用户密码）/ Fernet（设备密码） |
| 打包 | PyInstaller → 独立 EXE |
| 测试 | pytest（46 个测试用例） |

## 📁 项目结构

```
device-manager/
├── backend/
│   ├── main.py              # FastAPI 后端（39 个端点）
│   ├── models.py             # 9 张数据库表
│   ├── schemas.py            # Pydantic 模型
│   ├── auth.py               # JWT + bcrypt + Fernet
│   ├── database.py           # SQLite 配置
│   ├── requirements.txt      # Python 依赖
│   └── tests/                # 46 个测试用例
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.tsx           # 登录 + 首次改密
│   │   │   ├── DeviceList.tsx      # 设备列表（表格/卡片）
│   │   │   ├── DeviceForm.tsx      # 添加/编辑设备
│   │   │   ├── PasswordHistory.tsx # 密码历史（含旧密码）
│   │   │   ├── AuditLog.tsx        # 审计日志
│   │   │   ├── UserManagement.tsx  # 用户管理（导入/导出）
│   │   │   └── BackupRestore.tsx   # 备份与还原
│   │   ├── components/       # AppLayout, DeviceModal
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
python -m pytest tests/ -v  # 46 passed
```

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
| GET | `/api/devices` | 设备列表（四级权限过滤） |
| POST | `/api/devices` | 创建设备 |
| PUT | `/api/devices/{id}` | 更新设备 |
| DELETE | `/api/devices/{id}` | 删除设备 |

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
| GET | `/api/audit-logs` | 审计日志 |

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

## 📄 License

MIT
