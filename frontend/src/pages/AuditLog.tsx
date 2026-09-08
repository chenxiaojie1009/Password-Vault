import { useState, useEffect, useMemo } from 'react';
import { Table, Card, Input, Select, Space, Tag, DatePicker, Grid, Avatar } from 'antd';
const { useBreakpoint } = Grid;
import { AuditOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/client';
import { PageHeader, EmptyState } from '../components/ui';
import { ACTION_COLORS, ACTION_LABELS } from '../constants';

const { RangePicker } = DatePicker;
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

interface LogRecord {
  id: number;
  username: string;
  action: string;
  target_type: string;
  target_id: number | null;
  detail: string;
  ip_address: string;
  created_at: string;
}

export default function AuditLog() {
  const [data, setData] = useState<LogRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState<string | undefined>();
  const [userInput, setUserInput] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  // 输入防抖，避免每敲一个字符都请求后端
  useEffect(() => {
    const timer = setTimeout(() => setUserFilter(userInput.trim()), 400);
    return () => clearTimeout(timer);
  }, [userInput]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params: any = { page, page_size: 15 };
      if (actionFilter) params.action = actionFilter;
      if (userFilter) params.username = userFilter;
      if (dateRange) {
        params.start_date = dateRange[0].format('YYYY-MM-DD 00:00:00');
        params.end_date = dateRange[1].format('YYYY-MM-DD 23:59:59');
      }
      const res = await api.get('/audit-logs', { params });
      setData(res.data || []);
      setTotal(Number(res.headers['x-total-count'] || 0));
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, dateRange, userFilter]);

  const columns = useMemo(
    () => [
      {
        title: '时间',
        dataIndex: 'created_at',
        width: 176,
        render: (v: string) => (
          <span style={{ fontFamily: MONO, fontSize: 12.5 }}>{dayjs(v).format('YYYY-MM-DD HH:mm:ss')}</span>
        ),
      },
      {
        title: '用户',
        dataIndex: 'username',
        width: 140,
        render: (v: string) => (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Avatar size={24} style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', fontSize: 12 }}>
              {(v || '?').slice(0, 1).toUpperCase()}
            </Avatar>
            <span style={{ fontWeight: 500 }}>{v}</span>
          </span>
        ),
      },
      {
        title: '操作',
        dataIndex: 'action',
        width: 116,
        render: (v: string) => <Tag color={ACTION_COLORS[v] || 'default'}>{ACTION_LABELS[v] || v}</Tag>,
      },
      { title: '对象', dataIndex: 'target_type', width: 88, render: (v: string) => v || '-' },
      { title: '详情', dataIndex: 'detail', ellipsis: true },
      {
        title: 'IP',
        dataIndex: 'ip_address',
        width: 140,
        render: (v: string) => (
          <span style={{ fontFamily: MONO, fontSize: 12.5, color: 'var(--text-sub)' }}>{v || '-'}</span>
        ),
      },
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        icon={<AuditOutlined />}
        title="操作日志审计"
        subtitle={`共 ${total} 条操作记录 · 登录、增删改、导出全程留痕`}
        extra={
          <Space wrap>
            <Input
              placeholder="搜索用户"
              prefix={<SearchOutlined />}
              value={userInput}
              allowClear
              onChange={(e) => setUserInput(e.target.value)}
              onPressEnter={() => setUserFilter(userInput.trim())}
              style={{ width: isMobile ? 130 : 168 }}
            />
            <Select
              placeholder="操作类型"
              allowClear
              style={{ width: isMobile ? 110 : 130 }}
              value={actionFilter}
              onChange={setActionFilter}
              options={Object.entries(ACTION_LABELS).map(([k, v]) => ({ label: v, value: k }))}
            />
            <RangePicker
              value={dateRange}
              onChange={(vals) => setDateRange(vals as [dayjs.Dayjs, dayjs.Dayjs] | null)}
              placeholder={['开始日期', '结束日期']}
              style={{ width: isMobile ? 200 : undefined }}
            />
          </Space>
        }
      />

      <Card className="glass-card" styles={{ body: { padding: '4px 16px 16px' } }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: 860 }}
          pagination={{
            current: page,
            pageSize: 15,
            total,
            showTotal: (t: number) => `共 ${t} 条`,
            onChange: (p) => setPage(p),
          }}
          locale={{
            emptyText: (
              <EmptyState
                icon={<AuditOutlined />}
                title="暂无操作日志"
                description="调整筛选条件，或等待新的操作产生记录"
              />
            ),
          }}
        />
      </Card>
    </div>
  );
}
