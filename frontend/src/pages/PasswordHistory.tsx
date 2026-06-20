import { useState, useEffect } from "react";
import { Table, Card, Select, Typography, Space, Tag, DatePicker } from "antd";
import { HistoryOutlined, UserOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import api from "../api/client";

const { Title } = Typography;
const { RangePicker } = DatePicker;

interface HistoryRecord {
  id: number; account_id: number; changed_by: number;
  changed_by_name: string; changed_at: string; reason: string;
  old_password: string; account_name: string; device_name: string;
}

export default function PasswordHistory() {
  const [data, setData] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState<{ id: number; name: string }[]>([]);
  const [deviceId, setDeviceId] = useState<number | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const fetchDevices = async () => {
    try { const res = await api.get("/devices"); setDevices(res.data || []); } catch {}
  };
  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params: any = { page_size: 200 };
      if (deviceId) params.device_id = deviceId;
      if (dateRange) { params.start_date = dateRange[0].toISOString(); params.end_date = dateRange[1].toISOString(); }
      const res = await api.get("/password-history", { params });
      setData(res.data || []);
    } catch { setData([]); } finally { setLoading(false); }
  };
  useEffect(() => { fetchDevices(); }, []);
  useEffect(() => { fetchHistory(); }, [deviceId, dateRange]);

  const columns = [
    { title: "时间", dataIndex: "changed_at", width: 170, render: (v: string) => dayjs(v).format("YYYY-MM-DD HH:mm:ss") },
    { title: "设备", dataIndex: "device_name", width: 150, ellipsis: true },
    { title: "账号", dataIndex: "account_name", width: 120 },
    { title: "旧密码", dataIndex: "old_password", width: 150, ellipsis: true },
    { title: "操作人", dataIndex: "changed_by_name", width: 100, render: (v: string) => <Space><UserOutlined />{v}</Space> },
    { title: "原因", dataIndex: "reason", ellipsis: true },
    { title: "操作", key: "action", width: 90, render: () => <Tag color="blue">已变更</Tag> },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}><HistoryOutlined style={{ marginRight: 8 }} />密码修改历史</Title>
        <Space>
          <Select placeholder="筛选设备" allowClear style={{ width: 200 }} value={deviceId} onChange={setDeviceId}
            options={devices.map((d) => ({ label: d.name, value: d.id }))} />
          <RangePicker value={dateRange} onChange={(vals) => setDateRange(vals as [dayjs.Dayjs, dayjs.Dayjs] | null)}
            placeholder={["开始日期", "结束日期"]} />
        </Space>
      </div>
      <Card>
        <Table rowKey="id" columns={columns} dataSource={data} loading={loading}
          pagination={{ pageSize: 15, showTotal: (t: number) => `共 ${t} 条` }}
          locale={{ emptyText: "暂无密码修改记录" }} />
      </Card>
    </div>
  );
}
