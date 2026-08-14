import { useState, useEffect, useRef } from "react";
import { Card, Button, Space, Typography, message, Upload, Alert, Descriptions, Tag, Modal, Spin, Result } from "antd";
import { CloudUploadOutlined, RocketOutlined, ReloadOutlined, UndoOutlined, ThunderboltOutlined, CheckCircleOutlined } from "@ant-design/icons";
import api from "../api/client";

const { Text, Paragraph } = Typography;

interface UpgradeInfo {
  current_version: string;
  frozen: boolean;
  base_dir: string;
  applying: boolean;
  staged: null | {
    version: string;
    changelog: string;
    size_bytes: number;
    uploaded_at: string;
  };
}

export default function SystemUpgrade() {
  const [info, setInfo] = useState<UpgradeInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyDone, setApplyDone] = useState(false);
  const pollTimer = useRef<any>(null);

  const fetchInfo = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await api.get("/upgrade/info");
      setInfo(r.data);
      return r.data as UpgradeInfo;
    } catch {
      if (!silent) message.error("获取升级信息失败");
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  };
  useEffect(() => { fetchInfo(); return () => { if (pollTimer.current) clearInterval(pollTimer.current); }; }, []);

  const handleUpload = async (file: File): Promise<false> => {
    const fd = new FormData();
    fd.append("file", file);
    setUploading(true);
    try {
      const r = await api.post("/upgrade/upload", fd, { timeout: 300000 });
      message.success(`升级包上传成功：v${r.data.version}`);
      fetchInfo(true);
    } catch (err: any) {
      message.error(err.response?.data?.detail || "上传失败");
    } finally {
      setUploading(false);
    }
    return false;
  };

  const handleApply = async () => {
    setApplying(true);
    setApplyDone(false);
    try {
      const r = await api.post("/upgrade/apply");
      message.success(r.data.message || "升级已开始");
      // 轮询等待服务重启（连接失败 → 恢复即视为完成）
      let tries = 0;
      pollTimer.current = setInterval(async () => {
        tries += 1;
        try {
          const res = await api.get("/upgrade/info", { timeout: 5000 });
          const d = res.data as UpgradeInfo;
          if (!d.applying && d.current_version) {
            clearInterval(pollTimer.current);
            setApplying(false);
            setApplyDone(true);
            fetchInfo(true);
          }
        } catch {
          // 服务重启中，连接失败属正常
        }
        if (tries > 40) { // 最多等待约 200 秒
          clearInterval(pollTimer.current);
          setApplying(false);
          message.warning("等待超时，请手动刷新页面确认升级结果");
        }
      }, 5000);
    } catch (err: any) {
      setApplying(false);
      message.error(err.response?.data?.detail || "升级启动失败");
    }
  };

  const handleCancel = async () => {
    try {
      await api.post("/upgrade/cancel");
      message.success("已取消待升级包");
      fetchInfo(true);
    } catch {
      message.error("取消失败");
    }
  };

  const fmtSize = (b: number) => (b / 1024 / 1024).toFixed(1) + " MB";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              width: 34, height: 34, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center",
              background: "linear-gradient(135deg,#10b981,#3b82f6)", color: "#fff", boxShadow: "0 4px 12px rgba(16,185,129,0.4)",
            }}><ThunderboltOutlined /></span>
            系统升级
          </div>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => fetchInfo()} loading={loading}>刷新</Button>
      </div>

      <Alert type="info" showIcon style={{ marginBottom: 16 }}
        message="在线升级说明"
        description={
          <Paragraph style={{ marginBottom: 0, fontSize: 13 }}>
            <b>1.</b> 管理员上传新版本升级包（zip：含新 <Text code>DeviceManager.exe</Text> 与 <Text code>version.json</Text>）。<br/>
            <b>2.</b> 点击"立即升级"：系统<b>自动备份当前数据</b>（数据库 + 附件），再替换程序文件并自动重启。<br/>
            <b>3.</b> 升级<b>不会丢失数据</b>——数据库 device_manager.db 与 uploads/ 附件原样保留，旧程序文件自动存为备份。<br/>
            <b>4.</b> 升级过程中服务会短暂中断，请勿关闭页面，完成后自动恢复。
          </Paragraph>
        }
      />

      <Card size="small" className="glass-card" style={{ marginBottom: 16 }} title="当前版本">
        <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 3 }} style={{ marginTop: 4 }}>
          <Descriptions.Item label="当前版本">
            <Tag color="blue" style={{ fontSize: 14, padding: "2px 12px" }}>v{info?.current_version || "-"}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="运行环境">
            {info?.frozen ? <Tag color="green">独立程序 (EXE)</Tag> : <Tag>开发模式</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="运行目录">
            <Text style={{ fontSize: 12 }} copyable>{info?.base_dir || "-"}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="升级状态">
            {info?.applying ? <Tag color="orange">升级进行中</Tag> : <Tag color="default">正常</Tag>}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card size="small" className="glass-card" style={{ marginBottom: 16 }} title="上传升级包">
        <Space direction="vertical" style={{ width: "100%" }}>
          <Upload.Dragger
            accept=".zip"
            maxCount={1}
            showUploadList={false}
            disabled={!!info?.staged || uploading}
            beforeUpload={handleUpload as any}
            style={{ borderRadius: 12 }}
          >
            <p className="ant-upload-drag-icon"><CloudUploadOutlined /></p>
            <p className="ant-upload-text">点击或拖拽上传升级包（.zip）</p>
            <p className="ant-upload-hint">
              升级包需包含：DeviceManager.exe（新版本程序）+ version.json（版本信息）<br/>
              {info?.staged ? "已有待升级包，请先取消或直接升级" : "文件最大 300MB"}
            </p>
          </Upload.Dragger>
        </Space>
      </Card>

      {info?.staged && (
        <Card size="small" className="glass-card" style={{ marginBottom: 16, borderColor: "#10b981" }}
          title={<Space><CheckCircleOutlined style={{ color: "#10b981" }} />待升级包</Space>}>
          <Descriptions size="small" column={{ xs: 1, sm: 2 }} style={{ marginBottom: 12 }}>
            <Descriptions.Item label="新版本">
              <Tag color="green" style={{ fontSize: 14 }}>v{info.staged.version}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="大小">{fmtSize(info.staged.size_bytes)}</Descriptions.Item>
            <Descriptions.Item label="上传时间">{info.staged.uploaded_at}</Descriptions.Item>
          </Descriptions>
          {info.staged.changelog && (
            <Alert type="success" style={{ marginBottom: 12 }} message="更新说明"
              description={<div style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{info.staged.changelog}</div>} />
          )}
          <Space wrap>
            <Button type="primary" className="gradient-btn" icon={<RocketOutlined />} size="large"
              loading={applying} onClick={handleApply}>
              立即升级
            </Button>
            <Button icon={<UndoOutlined />} disabled={applying} onClick={handleCancel}>取消升级包</Button>
          </Space>
        </Card>
      )}

      <Modal open={applying} footer={null} closable={false} width={360}>
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, fontWeight: 600, fontSize: 15 }}>正在升级...</div>
          <div style={{ marginTop: 8, color: "#888", fontSize: 13 }}>
            数据已自动备份，正在替换程序文件并重启服务<br/>请勿关闭页面
          </div>
        </div>
      </Modal>

      <Modal open={applyDone} footer={null} closable={false} width={380}>
        <Result
          status="success"
          title="升级完成"
          subTitle={<>服务已重启，当前版本 <Tag color="green">v{info?.current_version || "-"}</Tag></>}
          extra={<Button type="primary" onClick={() => window.location.reload()}>刷新页面</Button>}
        />
      </Modal>
    </div>
  );
}
