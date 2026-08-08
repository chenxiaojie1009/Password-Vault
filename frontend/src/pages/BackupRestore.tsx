import { useState, useEffect } from "react";
import { Card, Button, Table, Space, Typography, message, Popconfirm, Upload, Divider, Alert } from "antd";
import { CloudUploadOutlined, DownloadOutlined, HistoryOutlined, RestOutlined, CloudServerOutlined } from "@ant-design/icons";
import api from "../api/client";

const { Text, Paragraph } = Typography;

interface BackupInfo {
  filename: string; size_bytes: number; created_at: string;
}

export default function BackupRestore() {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBackups = async () => {
    setLoading(true);
    try { const r = await api.get("/backups"); setBackups(r.data || []); }
    catch { message.error("获取备份列表失败"); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchBackups(); }, []);

  const handleCreate = async () => {
    try { await api.post("/backups"); message.success("备份完成"); fetchBackups(); }
    catch { message.error("备份失败"); }
  };

  const handleRestore = async (filename: string) => {
    try {
      await api.post("/backups/" + filename + "/restore");
      message.success("已还原，请手动重启服务");
    } catch { message.error("还原失败"); }
  };

  const handleDownload = async (filename: string) => {
    try {
      const res = await api.get("/backups/download/" + filename, { responseType: "blob" });
      const blob = new Blob([res.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch { message.error("下载失败"); }
  };

  const handleUploadRestore = async (file: File): Promise<false> => {
    const fd = new FormData(); fd.append("file", file);
    try {
      await api.post("/backups/restore", fd);
      message.success("已还原，请手动重启服务");
    } catch { message.error("还原失败"); }
    return false;
  };

  const columns = [
    { title: "备份文件", dataIndex: "filename", ellipsis: true },
    { title: "大小", dataIndex: "size_bytes", width: 100, render: (v: number) => (v / 1024).toFixed(1) + " KB" },
    { title: "时间", dataIndex: "created_at", width: 170,
      render: (v: string) => {
        const s = v.replace("backup_", "").replace(".db", "");
        const y = s.slice(0, 4), m = s.slice(4, 6), d = s.slice(6, 8);
        const h = s.slice(9, 11) || "00", min = s.slice(11, 13) || "00", sec = s.slice(13, 15) || "00";
        return `${y}-${m}-${d} ${h}:${min}:${sec}`;
      }
    },
    { title: "操作", width: 180,
      render: (_: any, r: BackupInfo) => (
        <Space>
          <Popconfirm title="确定还原此备份？当前数据将先自动备份" onConfirm={() => handleRestore(r.filename)}>
            <Button size="small" type="link" icon={<RestOutlined />}>还原</Button>
          </Popconfirm>
          <Button size="small" type="link" icon={<DownloadOutlined />} onClick={() => handleDownload(r.filename)}>下载</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              width: 34, height: 34, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center",
              background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", color: "#fff", boxShadow: "0 4px 12px rgba(59,130,246,0.4)",
            }}><HistoryOutlined /></span>
            备份与还原
          </div>
        </div>
      </div>

      <Alert type="info" showIcon style={{ marginBottom: 16 }}
        message="使用说明"
        description={
          <Paragraph style={{ marginBottom: 0, fontSize: 13 }}>
            <b>手动备份：</b>点击"立即备份"将当前全部数据保存为备份文件。<br/>
            <b>手动还原：</b>上传之前下载的 .db 文件，还原前会自动备份当前数据；还原后需重启服务。<br/>
            <b>自动备份：</b>每天凌晨 2:00 自动执行，保留最近 30 份，旧备份自动清理。<br/>
            <b>还原后：</b>双击 deploy\启动.vbs 重新启动服务。
          </Paragraph>
        }
      />

      <Card size="small" className="glass-card" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Button type="primary" className="gradient-btn" icon={<CloudServerOutlined />} onClick={handleCreate}>立即备份</Button>
          <Upload accept=".db" maxCount={1} showUploadList={false} beforeUpload={handleUploadRestore as any}>
            <Button icon={<CloudUploadOutlined />}>上传还原</Button>
          </Upload>
        </Space>
        <Divider style={{ margin: "12px 0" }} />
        <Text type="secondary">
          备份目录：deploy\backups\ &nbsp;|&nbsp;
          自动备份：每天凌晨 2:00 &nbsp;|&nbsp;
          保留：30 份
        </Text>
      </Card>

      <Card title="历史备份" className="glass-card">
        <Table rowKey="filename" columns={columns} dataSource={backups} loading={loading}
          pagination={{ pageSize: 15, showTotal: (t: number) => `共 ${t} 份` }}
          locale={{ emptyText: "暂无备份记录" }} />
      </Card>
    </div>
  );
}
