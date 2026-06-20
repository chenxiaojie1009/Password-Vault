import { useState, useEffect } from "react";
import { Modal, Descriptions, Table, Tag, Typography, Button, Space, message } from "antd";
import { EyeOutlined, EditOutlined, EyeInvisibleOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

const { Title, Text } = Typography;
const typeColors: Record<string, string> = { "服务器": "blue", "交换机": "green", "纵加设备": "orange", "路由器": "purple", "防火墙": "red", "存储设备": "cyan", "其他": "default" };

interface Props { open: boolean; detailId: number | null; editId: number | null; onClose: () => void; }

export default function DeviceModal({ open, detailId, editId, onClose }: Props) {
  const navigate = useNavigate();
  const [device, setDevice] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState<Record<number, boolean>>({});
  const actualId = detailId || editId;

  useEffect(() => {
    if (open && actualId) {
      setLoading(true);
      api.get("/devices/" + actualId)
        .then((res) => { setDevice(res.data); setShowPwd({}); })
        .catch(() => message.error("加载失败"))
        .finally(() => setLoading(false));
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
        {isView && <Button type="primary" onClick={() => { navigate("/devices/" + actualId + "/edit"); onClose(); }}>编辑</Button>}
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
      </>)}
    </Modal>
  );
}
