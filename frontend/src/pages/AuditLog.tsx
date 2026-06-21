import { useState, useEffect } from "react";
import { Table, Card, Input, Select, Typography, Space, Tag, DatePicker, Grid } from "antd";
const { useBreakpoint } = Grid;
import { AuditOutlined, SearchOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import api from "../api/client";

const { Title } = Typography;
const { RangePicker } = DatePicker;
const actionColors: Record<string, string> = { create: "green", update: "blue", delete: "red", export: "orange", import: "purple", login: "cyan" };
const actionLabels: Record<string, string> = { create: "创建", update: "修改", delete: "删除", export: "导出", import: "导入", login: "登录" };

interface LogRecord { id: number; username: string; action: string; target_type: string; target_id: number | null; detail: string; ip_address: string; created_at: string; }

export default function AuditLog() {
  const [data, setData] = useState<LogRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState<string | undefined>();
  const [userFilter, setUserFilter] = useState("");
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [page, setPage] = useState(1);
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params: any = { page, page_size: 15 };
      if (actionFilter) params.action = actionFilter;
      if (userFilter) params.user_id = userFilter || undefined;
      if (dateRange) { params.start_date = dateRange[0].toISOString(); params.end_date = dateRange[1].toISOString(); }
      const res = await api.get("/audit-logs", { params });
      setData(res.data || []);
    } catch { setData([]); } finally { setLoading(false); }
  };
  useEffect(() => { fetchLogs(); }, [page, actionFilter, dateRange]);

  const columns = [
    { title: "时间", dataIndex: "created_at", width: 180, render: (v: string) => dayjs(v).format("YYYY-MM-DD HH:mm:ss") },
    { title: "用户", dataIndex: "username", width: 120 },
    { title: "操作", dataIndex: "action", width: 100, render: (v: string) => <Tag color={actionColors[v] || "default"}>{actionLabels[v] || v}</Tag> },
    { title: "对象", dataIndex: "target_type", width: 80 },
    { title: "详情", dataIndex: "detail", ellipsis: true },
    { title: "IP", dataIndex: "ip_address", width: 140 },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
        <Title level={4} style={{ margin: 0 }}><AuditOutlined style={{ marginRight: 8 }} />操作日志审计</Title>
        <Space wrap>
          <Input placeholder="搜索用户" prefix={<SearchOutlined />} value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)} onPressEnter={fetchLogs} style={{ width: isMobile ? 120 : 160 }} />
          <Select placeholder="操作类型" allowClear style={{ width: isMobile ? 100 : 120 }} value={actionFilter} onChange={setActionFilter}
            options={Object.entries(actionLabels).map(([k, v]) => ({ label: v, value: k }))} />
          <RangePicker value={dateRange} onChange={(vals) => setDateRange(vals as [dayjs.Dayjs, dayjs.Dayjs] | null)}
            placeholder={["开始", "结束"]} style={{ width: isMobile ? 180 : undefined }} />
        </Space>
      </div>
      <Card>
        <Table rowKey="id" columns={columns} dataSource={data} loading={loading} scroll={{ x: 700 }}
          pagination={{ current: page, pageSize: 15, showTotal: (t: number) => `共 ${t} 条`, onChange: (p) => setPage(p) }}
          locale={{ emptyText: "暂无操作日志" }} />
      </Card>
    </div>
  );
}
