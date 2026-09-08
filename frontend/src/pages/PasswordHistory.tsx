import { useState, useEffect, useMemo } from 'react';
import { Table, Card, Select, Space, Tag, DatePicker, Button, Tooltip, message, Avatar } from 'antd';
import { HistoryOutlined, CopyOutlined, FilterOutlined, CloudServerOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/client';
import { PageHeader, EmptyState } from '../components/ui';
import { copyText } from '../utils';

const { RangePicker } = DatePicker;
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

interface HistoryRecord {
  id: number;
  account_id: number;
  changed_by: number;
  changed_by_name: string;
  changed_at: string;
  reason: string;
  old_password: string;
  account_name: string;
  device_name: string;
}

export default function PasswordHistory() {
  const [data, setData] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState<{ id: number; name: string }[]>([]);
  const [deviceId, setDeviceId] = useState<number | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const fetchDevices = async () => {
    try {
      const res = await api.get('/devices');
      setDevices(res.data.items || []);
    } catch {
      /* 忽略 */
    }
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params: any = { page_size: 200 };
      if (deviceId) params.device_id = deviceId;
      if (dateRange) {
        params.start_date = dateRange[0].format('YYYY-MM-DD 00:00:00');
        params.end_date = dateRange[1].format('YYYY-MM-DD 23:59:59');
      }
      const res = await api.get('/password-history', { params });
      setData(res.data || []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);
  useEffect(() => {
    fetchHistory();
  }, [deviceId, dateRange]);

  const columns = useMemo(
    () => [
      {
        title: '变更时间',
        dataIndex: 'changed_at',
        width: 170,
        render: (v: string) => (
          <span style={{ fontFamily: MONO, fontSize: 12.5 }}>{dayjs(v).format('YYYY-MM-DD HH:mm:ss')}</span>
        ),
      },
      {
        title: '设备',
        dataIndex: 'device_name',
        width: 180,
        ellipsis: true,
        render: (v: string) => (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span
              className="icon-badge"
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                fontSize: 13,
                background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
                boxShadow: 'none',
              }}
            >
              <CloudServerOutlined />
            </span>
            <span style={{ fontWeight: 500 }}>{v}</span>
          </span>
        ),
      },
      {
        title: '账号',
        dataIndex: 'account_name',
        width: 120,
        render: (v: string) => <Tag color="geekblue">{v}</Tag>,
      },
      {
        title: '旧密码',
        dataIndex: 'old_password',
        width: 210,
        render: (v: string) => (
          <Space size={4}>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 12.5,
                padding: '2px 8px',
                borderRadius: 8,
                background: 'rgba(100,116,139,0.09)',
                color: 'var(--text-sub)',
              }}
            >
              {v || '-'}
            </span>
            {v && (
              <Tooltip title="复制旧密码">
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={async () => {
                    const ok = await copyText(v);
                    if (ok) message.success('旧密码已复制');
                    else message.error('复制失败');
                  }}
                />
              </Tooltip>
            )}
          </Space>
        ),
      },
      {
        title: '操作人',
        dataIndex: 'changed_by_name',
        width: 130,
        render: (v: string) => (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Avatar size={24} style={{ background: 'linear-gradient(135deg,#10b981,#3b82f6)', fontSize: 12 }}>
              {(v || '?').slice(0, 1)}
            </Avatar>
            {v || '-'}
          </span>
        ),
      },
      {
        title: '变更原因',
        dataIndex: 'reason',
        ellipsis: true,
        render: (v: string) => (v ? <Tag color="orange">{v}</Tag> : <span style={{ color: 'var(--text-muted)' }}>-</span>),
      },
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        icon={<HistoryOutlined />}
        title="密码修改历史"
        subtitle={`共 ${data.length} 条改密记录 · 含旧密码明文留档`}
        extra={
          <Space wrap>
            <Select
              placeholder="筛选设备"
              allowClear
              style={{ width: 176 }}
              value={deviceId}
              onChange={setDeviceId}
              options={devices.map((d) => ({ label: d.name, value: d.id }))}
              suffixIcon={<FilterOutlined />}
            />
            <RangePicker
              value={dateRange}
              onChange={(vals) => setDateRange(vals as [dayjs.Dayjs, dayjs.Dayjs] | null)}
              placeholder={['开始日期', '结束日期']}
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
          scroll={{ x: 1000 }}
          pagination={{ pageSize: 15, showTotal: (t: number) => `共 ${t} 条` }}
          locale={{
            emptyText: (
              <EmptyState
                icon={<HistoryOutlined />}
                title="暂无密码修改记录"
                description="设备密码被修改后，这里会保留变更时间、操作人与旧密码"
              />
            ),
          }}
        />
      </Card>
    </div>
  );
}
