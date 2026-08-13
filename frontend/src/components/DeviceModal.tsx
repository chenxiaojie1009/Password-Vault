import { useState, useEffect } from "react";
import { Modal, Descriptions, Table, Tag, Typography, Button, Space, message } from "antd";
import { EyeOutlined, EditOutlined, EyeInvisibleOutlined, DownloadOutlined, CopyOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { copyText } from "../utils";

const { Title, Text } = Typography;
const typeColors: Record<string, string> = { "服务器": "blue", "交换机": "green", "纵加设备": "orange", "路由器": "purple", "防火墙": "red", "存储设备": "cyan", "其他": "default" };
const ROLE_MAX_LEVEL: Record<string, number> = { admin: 4, operator: 3, editor: 2, viewer: 1 };
const LEVEL_NUM: Record<string, number> = { "一级设备": 1, "二级设备": 2, "三级设备": 3, "四级设备": 4 };

function canEditDevice(role: string, deviceLevel: string): boolean {
  return (LEVEL_NUM[deviceLevel] || 1) <= (ROLE_MAX_LEVEL[role] || 1);
}

interface Props { open: boolean; detailId: number | null; editId: number | null; onClose: () => void; }

export default function DeviceModal({ open, detailId, editId, onClose }: Props) {
  const navigate = useNavigate();
  const [device, setDevice] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState<Record<number, boolean>>({});
  const [files, setFiles] = useState<any[]>([]);
  const actualId = detailId || editId;

  useEffect(() => {
    if (open && actualId) {
      setLoading(true);
      api.get("/devices/" + actualId)
        .then((res) => { setDevice(res.data); setShowPwd({}); })
        .catch(() => message.error("加载失败"))
        .finally(() => setLoading(false));
      // Fetch files
      api.get("/devices/" + actualId + "/files")
        .then((res) => setFiles(res.data || []))
        .catch(() => {});
    } else { setDevice(null); }
  }, [open, actualId]);

  if (!actualId && open) { navigate("/devices/new"); return null; }
  if (!device && loading) return null;
  const isView = !!detailId;

  const togglePwd = (id: number) => setShowPwd((prev) => ({ ...prev, [id]: !prev[id] }));

  const acctColumns = [
    { title: "账号", dataIndex: "username", key: "username", width: 100 },
    {
      title: "密码", dataIndex: "password", key: "password", width: 200,
      render: (pwd: string, record: any) => (
        <Space>
          <Text code style={{ letterSpacing: 1 }}>
            {showPwd[record.id] ? pwd : "••••••••"}
          </Text>
          <Button type="text" size="small"
            icon={showPwd[record.id] ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            onClick={() => togglePwd(record.id)} />
          <Button type="text" size="small" icon={<CopyOutlined />} title="复制密码"
            onClick={async () => {
              (await copyText(pwd || "")) ? message.success("密码已复制") : message.error("复制失败");
            }} />
        </Space>
      ),
    },
    { title: "备注", dataIndex: "notes", key: "notes" },
    { title: "更新时间", dataIndex: "updated_at", key: "updated_at",
      render: (v: string) => v ? new Date(v).toLocaleString("zh-CN") : "-" },
  ];

  return (
    <Modal
      title={<Space>{isView ? <EyeOutlined /> : <EditOutlined />}<span>{device?.name || "设备详情"}</span>
        <Tag color={typeColors[device?.device_type] || "default"}>{device?.device_type}</Tag></Space>}
      open={open} onCancel={onClose}
      footer={<Space><Button onClick={onClose}>关闭</Button>
        {isView && canEditDevice(JSON.parse(localStorage.getItem("user") || "{}").role, device?.device_level || "一级设备") &&
          <Button type="primary" onClick={() => { navigate("/devices/" + actualId + "/edit"); onClose(); }}>编辑</Button>}
      </Space>}
      width={760}>
      {device && (<>
        <Descriptions column={2} size="small" bordered style={{ marginBottom: 12 }}>
          <Descriptions.Item label="名称">{device.name}</Descriptions.Item>
          <Descriptions.Item label="类型"><Tag color={typeColors[device.device_type]}>{device.device_type}</Tag></Descriptions.Item>
          <Descriptions.Item label="位置">{device.location || "-"}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{device.updated_at ? new Date(device.updated_at).toLocaleString("zh-CN") : "-"}</Descriptions.Item>
          <Descriptions.Item label="备注" span={2}>{device.notes || "-"}</Descriptions.Item>
        </Descriptions>

        <Title level={5}>IP 地址</Title>
        {(device.ips || []).length === 0 ? <Text type="secondary">无</Text> :
          <Table rowKey="id" dataSource={device.ips} pagination={false} size="small" style={{ marginBottom: 12 }}
            columns={[{ title: "地址", dataIndex: "address" }, { title: "标签", dataIndex: "label" }]} />}

        <Title level={5}>MAC 地址</Title>
        {(device.macs || []).length === 0 ? <Text type="secondary">无</Text> :
          <Table rowKey="id" dataSource={device.macs} pagination={false} size="small" style={{ marginBottom: 12 }}
            columns={[{ title: "地址", dataIndex: "address" }, { title: "标签", dataIndex: "label" }]} />}

        <Title level={5}>账号密码</Title>
        <Table rowKey="id" columns={acctColumns} dataSource={device.accounts || []} pagination={false} size="small" />

        <Title level={5} style={{ marginTop: 16 }}>附件</Title>
        {files.length === 0 ? <Text type="secondary">无</Text> : (
          <div style={{ marginBottom: 8 }}>
            {files.map((f: any) => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #f0f0f0" }}>
                <Space>
                  <Tag>{f.file_type?.toUpperCase()}</Tag>
                  <span>{f.original_filename}</span>
                  <span style={{ color: "#999", fontSize: 12 }}>
                    {f.file_size < 1024 ? f.file_size + " B" : f.file_size < 1024 * 1024 ? (f.file_size / 1024).toFixed(1) + " KB" : (f.file_size / (1024 * 1024)).toFixed(2) + " MB"}
                  </span>
                  <span style={{ color: "#aaa", fontSize: 12 }}>{f.upload_by_name}</span>
                </Space>
                <Button size="small" type="link" icon={<DownloadOutlined />}
                  onClick={async () => {
                    try {
                      const res = await api.get("/files/" + f.id + "/download", { responseType: "blob" });
                      const url = URL.createObjectURL(new Blob([res.data]));
                      const a = document.createElement("a");
                      a.href = url; a.download = f.original_filename; a.click();
                      URL.revokeObjectURL(url);
                    } catch { message.error("下载失败"); }
                  }}>下载</Button>
              </div>
            ))}
          </div>
        )}
      </>)}
    </Modal>
  );
}
