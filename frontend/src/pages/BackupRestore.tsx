import { useState, useEffect, useMemo } from 'react';
import { Card, Button, Table, Space, Typography, message, Popconfirm, Upload, Tag, Tooltip } from 'antd';
import {
  CloudUploadOutlined, DownloadOutlined, HistoryOutlined, RestOutlined,
  CloudServerOutlined, DatabaseOutlined, ClockCircleOutlined, SafetyOutlined,
} from '@ant-design/icons';
import api from '../api/client';
import { PageHeader, EmptyState, SectionCard } from '../components/ui';

const { Text } = Typography;
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

interface BackupInfo {
  filename: string;
  size_bytes: number;
  created_at: string;
}

const TIPS = [
  { icon: <CloudServerOutlined />, title: '手动备份', desc: '点击「立即备份」将当前全部数据保存为备份文件' },
  { icon: <CloudUploadOutlined />, title: '手动还原', desc: '上传 .db 备份文件，还原前会自动备份当前数据' },
  { icon: <ClockCircleOutlined />, title: '自动备份', desc: '每天凌晨 2:00 自动执行，保留最近 30 份' },
  { icon: <SafetyOutlined />, title: '还原之后', desc: '双击 deploy\\启动.vbs 重新启动服务' },
];

export default function BackupRestore() {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const r = await api.get('/backups');
      setBackups(r.data || []);
    } catch {
      message.error('获取备份列表失败');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchBackups();
  }, []);

  const handleCreate = async () => {
    try {
      await api.post('/backups');
      message.success('备份完成');
      fetchBackups();
    } catch {
      message.error('备份失败');
    }
  };

  const handleRestore = async (filename: string) => {
    try {
      await api.post('/backups/' + filename + '/restore');
      message.success('已还原，请手动重启服务');
    } catch {
      message.error('还原失败');
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      const res = await api.get('/backups/download/' + filename, { responseType: 'blob' });
      const blob = new Blob([res.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      message.error('下载失败');
    }
  };

  const handleUploadRestore = async (file: File): Promise<false> => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      await api.post('/backups/restore', fd);
      message.success('已还原，请手动重启服务');
    } catch {
      message.error('还原失败');
    }
    return false;
  };

  const columns = useMemo(
    () => [
      {
        title: '备份文件',
        dataIndex: 'filename',
        ellipsis: true,
        render: (v: string) => (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <span
              className="icon-badge"
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                fontSize: 15,
                background: 'linear-gradient(135deg,#10b981,#3b82f6)',
                boxShadow: 'none',
              }}
            >
              <DatabaseOutlined />
            </span>
            <span style={{ fontFamily: MONO, fontSize: 12.5 }}>{v}</span>
          </span>
        ),
      },
      {
        title: '大小',
        dataIndex: 'size_bytes',
        width: 110,
        render: (v: number) => <Tag color="cyan">{(v / 1024).toFixed(1)} KB</Tag>,
      },
      {
        title: '备份时间',
        dataIndex: 'created_at',
        width: 180,
        render: (v: string) => {
          const s = v.replace('backup_', '').replace('.db', '');
          const y = s.slice(0, 4), m = s.slice(4, 6), d = s.slice(6, 8);
          const h = s.slice(9, 11) || '00', min = s.slice(11, 13) || '00', sec = s.slice(13, 15) || '00';
          return <span style={{ fontFamily: MONO, fontSize: 12.5 }}>{`${y}-${m}-${d} ${h}:${min}:${sec}`}</span>;
        },
      },
      {
        title: '操作',
        width: 170,
        align: 'right' as const,
        render: (_: any, r: BackupInfo) => (
          <Space size={2}>
            <Popconfirm title="确定还原此备份？" description="当前数据将先自动备份" onConfirm={() => handleRestore(r.filename)}>
              <Tooltip title="还原此备份">
                <Button type="text" size="small" icon={<RestOutlined />} />
              </Tooltip>
            </Popconfirm>
            <Tooltip title="下载到本地">
              <Button type="text" size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(r.filename)} />
            </Tooltip>
          </Space>
        ),
      },
    ],
    [],
  );

  return (
    <div>
      <PageHeader icon={<HistoryOutlined />} title="备份与还原" subtitle="数据备份、历史版本管理与一键回滚" />

      <Card className="glass-card" style={{ marginBottom: 16 }} styles={{ body: { padding: 20 } }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }}>
          {TIPS.map((t) => (
            <div key={t.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span
                className="icon-badge"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 11,
                  fontSize: 16,
                  background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
                  boxShadow: 'none',
                }}
              >
                {t.icon}
              </span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t.title}</div>
                <div style={{ color: 'var(--text-sub)', fontSize: 12.5, marginTop: 3, lineHeight: 1.6 }}>{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card
        className="glass-card top-sheen"
        style={{ marginBottom: 16 }}
        styles={{ body: { padding: 20 } }}
      >
        <div className="toolbar">
          <Space wrap>
            <Button
              type="primary"
              className="gradient-btn"
              size="large"
              icon={<CloudServerOutlined />}
              onClick={handleCreate}
            >
              立即备份
            </Button>
            <Upload accept=".db" maxCount={1} showUploadList={false} beforeUpload={handleUploadRestore as any}>
              <Button size="large" icon={<CloudUploadOutlined />}>
                上传还原
              </Button>
            </Upload>
          </Space>
          <Text type="secondary" style={{ fontSize: 12.5 }}>
            备份目录：deploy\backups\ · 自动备份：每天凌晨 2:00 · 保留 30 份
          </Text>
        </div>
      </Card>

      <SectionCard
        icon={<DatabaseOutlined />}
        title="历史备份"
        extra={
          <Button type="link" size="small" onClick={fetchBackups}>
            刷新
          </Button>
        }
        bodyStyle={{ padding: '4px 16px 16px' }}
      >
        <Table
          rowKey="filename"
          columns={columns}
          dataSource={backups}
          loading={loading}
          scroll={{ x: 700 }}
          pagination={{ pageSize: 15, showTotal: (t: number) => `共 ${t} 份` }}
          locale={{
            emptyText: (
              <EmptyState
                icon={<DatabaseOutlined />}
                title="暂无备份记录"
                description="点击「立即备份」创建第一份备份，或等待每天凌晨的自动备份"
                actionText="立即备份"
                onAction={handleCreate}
              />
            ),
          }}
        />
      </SectionCard>
    </div>
  );
}
