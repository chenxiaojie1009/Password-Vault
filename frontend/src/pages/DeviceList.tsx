import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table, Button, Input, Select, Space, Tag, Card, Popconfirm, message, Tooltip, Grid, Pagination,
  Segmented, Checkbox, Row, Col, Badge,
} from 'antd';
const { useBreakpoint } = Grid;
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, ExportOutlined,
  ImportOutlined, ReloadOutlined, EyeOutlined, CloudServerOutlined, AppstoreOutlined,
  UnorderedListOutlined, WarningOutlined, UserOutlined, GlobalOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import DeviceModal from '../components/DeviceModal';
import { PageHeader, EmptyState } from '../components/ui';
import { TYPE_COLORS, TYPE_GRADIENTS, TYPE_ICONS, LEVEL_COLORS, canEditDevice } from '../constants';

interface Device {
  id: number;
  name: string;
  device_type: string;
  ip_address: string;
  mac_address: string;
  account_count: number;
  is_network_involved: boolean;
  device_level: string;
  location?: string;
  updated_at: string;
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export default function DeviceList() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [typeOptions, setTypeOptions] = useState<string[]>([
    '服务器', '交换机', '纵加设备', '路由器', '防火墙', '存储设备', '工作站', '其他',
  ]);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [view, setView] = useState<'table' | 'card'>('table');
  const navigate = useNavigate();
  const user = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}'), []);
  const canEdit = user.role === 'admin' || user.role === 'editor';
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  useEffect(() => {
    api
      .get('/config/device_types')
      .then((r) => {
        const vals = r.data?.map((i: any) => i.value) || [];
        setTypeOptions((prev) => [...new Set([...prev, ...vals])]);
      })
      .catch(() => {});
  }, []);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/devices', {
        params: {
          keyword: search || undefined,
          device_type: typeFilter || undefined,
          page,
          page_size: pageSize,
        },
      });
      setDevices(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch {
      message.error('获取设备列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, typeFilter]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleDelete = async (id: number) => {
    try {
      await api.delete('/devices/' + id);
      message.success('已删除');
      fetchDevices();
    } catch {
      message.error('删除失败');
    }
  };

  const handleExport = async (ids?: React.Key[]) => {
    try {
      const res = await api.post(
        '/export',
        { format: 'xlsx', device_ids: ids && ids.length ? ids.map(Number) : undefined },
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = '设备列表_' + new Date().toISOString().slice(0, 10) + '.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      message.success(ids && ids.length ? `已导出 ${ids.length} 台选中设备` : '导出成功');
    } catch {
      message.error('导出失败');
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res = await api.post('/import/xlsx', fd);
        message.success('导入完成：共 ' + res.data.total + ' 条，成功 ' + res.data.success);
        fetchDevices();
      } catch {
        message.error('导入失败');
      }
    };
    input.click();
  };

  const columns: ColumnsType<Device> = [
    {
      title: '设备名称',
      dataIndex: 'name',
      width: 240,
      render: (name: string, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            className="icon-badge"
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              fontSize: 15,
              background: TYPE_GRADIENTS[record.device_type] || TYPE_GRADIENTS.其他,
            }}
          >
            {TYPE_ICONS[record.device_type] || TYPE_ICONS.其他}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              {name}
              {record.is_network_involved && (
                <Tooltip title="涉网设备：仅运维者 / 管理员可查看">
                  <Tag color="red" style={{ fontSize: 11, paddingInline: 6 }}>
                    <WarningOutlined /> 涉网
                  </Tag>
                </Tooltip>
              )}
            </div>
            {record.location && (
              <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{record.location}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'device_type',
      width: 108,
      render: (t: string) => <Tag color={TYPE_COLORS[t] || 'default'}>{t}</Tag>,
    },
    {
      title: 'IP 地址',
      dataIndex: 'ip_address',
      width: 140,
      render: (v: string) => <span style={{ fontFamily: MONO, fontSize: 13 }}>{v || '-'}</span>,
    },
    {
      title: 'MAC 地址',
      dataIndex: 'mac_address',
      width: 160,
      render: (v: string) => (
        <span style={{ fontFamily: MONO, fontSize: 12.5, color: 'var(--text-sub)' }}>{v || '-'}</span>
      ),
    },
    {
      title: '账号',
      dataIndex: 'account_count',
      width: 84,
      align: 'center',
      render: (c: number) => (
        <Badge
          count={c}
          showZero
          overflowCount={99}
          style={{
            background: c > 0 ? 'rgba(59,130,246,0.12)' : 'rgba(100,116,139,0.12)',
            color: c > 0 ? '#2563eb' : 'var(--text-muted)',
            boxShadow: 'none',
            fontWeight: 600,
          }}
        />
      ),
    },
    {
      title: '分级',
      dataIndex: 'device_level',
      width: 96,
      render: (v: string) => <Tag color={LEVEL_COLORS[v] || 'default'}>{v}</Tag>,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 160,
      render: (t: string) => (
        <span style={{ color: 'var(--text-sub)', fontSize: 13 }}>
          {t ? new Date(t).toLocaleString('zh-CN', { hour12: false }) : '-'}
        </span>
      ),
    },
    {
      title: '操作',
      width: 132,
      align: 'right',
      render: (_, record) => (
        <Space size={2}>
          <Tooltip title="查看详情">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setDetailId(record.id);
                setModalOpen(true);
              }}
            />
          </Tooltip>
          {canEditDevice(user.role, record.device_level) && (
            <>
              <Tooltip title="编辑">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => navigate('/devices/' + record.id + '/edit')}
                />
              </Tooltip>
              <Popconfirm title="确定删除此设备？" description="删除后不可恢复" onConfirm={() => handleDelete(record.id)}>
                <Tooltip title="删除">
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  const toggleSelect = (id: number, checked: boolean) => {
    setSelectedKeys((prev) => (checked ? [...prev, id] : prev.filter((k) => k !== id)));
  };

  const deviceCard = (d: Device, index: number) => {
    const editable = canEditDevice(user.role, d.device_level);
    return (
      <Card
        key={d.id}
        className="glass-card hover-lift top-sheen"
        style={{
          height: '100%',
          animation: `fadeInUp .45s ${Math.min(index, 8) * 0.05}s cubic-bezier(0.22,1,0.36,1) both`,
        }}
        styles={{ body: { padding: 18 } }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <Checkbox
            checked={selectedKeys.includes(d.id)}
            onChange={(e) => toggleSelect(d.id, e.target.checked)}
            style={{ marginTop: 4 }}
          />
          <span
            className="icon-badge"
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              fontSize: 20,
              background: TYPE_GRADIENTS[d.device_type] || TYPE_GRADIENTS.其他,
            }}
          >
            {TYPE_ICONS[d.device_type] || TYPE_ICONS.其他}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 650, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
              {d.is_network_involved && (
                <Tag color="red" style={{ fontSize: 11, paddingInline: 6 }}>
                  涉网
                </Tag>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
              <Tag color={TYPE_COLORS[d.device_type] || 'default'}>{d.device_type}</Tag>
              <Tag color={LEVEL_COLORS[d.device_level] || 'default'}>{d.device_level}</Tag>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px dashed var(--line-strong)',
            display: 'grid',
            gap: 8,
            fontSize: 12.5,
            color: 'var(--text-sub)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <GlobalOutlined style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontFamily: MONO }}>{d.ip_address || '未填写'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserOutlined style={{ color: 'var(--text-muted)' }} />
            <span>{d.account_count} 个账号</span>
            {d.location && <span style={{ color: 'var(--text-muted)' }}>· {d.location}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClockCircleOutlined style={{ color: 'var(--text-muted)' }} />
            <span>{d.updated_at ? new Date(d.updated_at).toLocaleString('zh-CN', { hour12: false }) : '-'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <Button
            size="small"
            block
            icon={<EyeOutlined />}
            onClick={() => {
              setDetailId(d.id);
              setModalOpen(true);
            }}
          >
            详情
          </Button>
          {editable && (
            <Button size="small" block icon={<EditOutlined />} onClick={() => navigate('/devices/' + d.id + '/edit')}>
              编辑
            </Button>
          )}
          {editable && (
            <Popconfirm title="确定删除此设备？" description="删除后不可恢复" onConfirm={() => handleDelete(d.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div>
      <PageHeader
        icon={<CloudServerOutlined />}
        title="设备列表"
        subtitle={`共 ${total} 台设备 · 内网账号密码集中管理`}
        extra={
          <>
            {canEdit && (
              <Button icon={<ImportOutlined />} onClick={handleImport}>
                批量导入
              </Button>
            )}
            <Button icon={<ExportOutlined />} onClick={() => handleExport()}>
              导出
            </Button>
            <Button type="primary" className="gradient-btn" icon={<PlusOutlined />} onClick={() => navigate('/devices/new')}>
              添加设备
            </Button>
          </>
        }
      />

      <Card className="glass-card" style={{ marginBottom: 16 }} styles={{ body: { padding: 16 } }}>
        <div className="toolbar">
          <Space wrap>
            <Input
              placeholder="搜索名称 / IP / MAC"
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              allowClear
              style={{ width: 236 }}
            />
            <Select
              placeholder="设备类型"
              value={typeFilter || undefined}
              allowClear
              style={{ width: 138 }}
              onChange={(v) => {
                setTypeFilter(v || '');
                setPage(1);
              }}
              options={typeOptions.map((t) => ({ label: t, value: t }))}
            />
            <Tooltip title="刷新列表">
              <Button icon={<ReloadOutlined />} onClick={fetchDevices} />
            </Tooltip>
          </Space>
          <Space wrap>
            {selectedKeys.length > 0 && (
              <>
                <Tag color="blue" style={{ paddingInline: 10, height: 26, lineHeight: '24px' }}>
                  已选 {selectedKeys.length} 项
                </Tag>
                <Button icon={<ExportOutlined />} onClick={() => handleExport(selectedKeys)}>
                  导出选中
                </Button>
                <Button type="text" size="small" onClick={() => setSelectedKeys([])}>
                  清除
                </Button>
              </>
            )}
            {!isMobile && (
            <Segmented
              value={view}
              onChange={(v) => setView(v as 'table' | 'card')}
              options={[
                { label: '表格', value: 'table', icon: <UnorderedListOutlined /> },
                { label: '卡片', value: 'card', icon: <AppstoreOutlined /> },
              ]}
            />
            )}
          </Space>
        </div>
      </Card>

      {(isMobile ? 'card' : view) === 'table' ? (
        <Card className="glass-card" styles={{ body: { padding: '4px 16px 16px' } }}>
          <Table
            columns={columns}
            dataSource={devices}
            rowKey="id"
            loading={loading}
            scroll={{ x: 1100 }}
            sticky={{ offsetHeader: 62 }}
            rowSelection={{ selectedRowKeys: selectedKeys, onChange: (keys) => setSelectedKeys(keys) }}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              showTotal: (t: number) => `共 ${t} 条`,
              onChange: (p, ps) => {
                setPage(p);
                if (ps && ps !== pageSize) {
                  setPageSize(ps);
                  setPage(1);
                }
              },
            }}
            locale={{
              emptyText: (
                <EmptyState
                  icon={<CloudServerOutlined />}
                  title="暂无设备"
                  description="还没有录入任何设备，先添加一台试试"
                  actionText={canEdit ? '添加设备' : undefined}
                  onAction={() => navigate('/devices/new')}
                />
              ),
            }}
          />
        </Card>
      ) : (
        <>
          {loading ? (
            <Row gutter={[16, 16]}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Col xs={24} sm={12} xl={8} key={i}>
                  <Card className="glass-card shimmer" style={{ height: 210 }} />
                </Col>
              ))}
            </Row>
          ) : devices.length === 0 ? (
            <Card className="glass-card">
              <EmptyState
                icon={<CloudServerOutlined />}
                title="暂无设备"
                description="还没有录入任何设备，先添加一台试试"
                actionText={canEdit ? '添加设备' : undefined}
                onAction={() => navigate('/devices/new')}
              />
            </Card>
          ) : (
            <>
              <Row gutter={[16, 16]}>{devices.map((d, i) => (
                <Col xs={24} sm={12} xl={8} key={d.id}>
                  {deviceCard(d, i)}
                </Col>
              ))}</Row>
              {total > pageSize && (
                <Pagination
                  size="small"
                  current={page}
                  pageSize={pageSize}
                  total={total}
                  showSizeChanger
                  showTotal={(t: number) => `共 ${t} 条`}
                  onChange={(p, ps) => {
                    setPage(p);
                    if (ps !== pageSize) {
                      setPageSize(ps);
                      setPage(1);
                    }
                  }}
                  style={{ textAlign: 'center', marginTop: 20 }}
                />
              )}
            </>
          )}
        </>
      )}

      <DeviceModal
        open={modalOpen}
        detailId={detailId}
        editId={null}
        onClose={() => {
          setModalOpen(false);
          setDetailId(null);
        }}
      />
    </div>
  );
}
