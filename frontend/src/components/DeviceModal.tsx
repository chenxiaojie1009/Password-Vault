import { useState, useEffect } from 'react';
import { Modal, Descriptions, Table, Tag, Typography, Button, Space, message, Avatar } from 'antd';
import {
  EyeOutlined, EditOutlined, EyeInvisibleOutlined, DownloadOutlined, CopyOutlined,
  FileOutlined, GlobalOutlined, HddOutlined, PaperClipOutlined, UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { copyText } from '../utils';
import { TYPE_COLORS, LEVEL_COLORS, canEditDevice } from '../constants';
import { formatSize } from '../utils';

const { Text } = Typography;
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

interface Props {
  open: boolean;
  detailId: number | null;
  editId: number | null;
  onClose: () => void;
}

const SectionTitle = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '18px 0 10px' }}>
    <span
      className="icon-badge"
      style={{
        width: 24,
        height: 24,
        borderRadius: 8,
        fontSize: 12,
        background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
        boxShadow: 'none',
      }}
    >
      {icon}
    </span>
    <span style={{ fontWeight: 650, fontSize: 14 }}>{children}</span>
  </div>
);

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
      api
        .get('/devices/' + actualId)
        .then((res) => {
          setDevice(res.data);
          setShowPwd({});
        })
        .catch(() => message.error('加载失败'))
        .finally(() => setLoading(false));
      api
        .get('/devices/' + actualId + '/files')
        .then((res) => setFiles(res.data || []))
        .catch(() => {});
    } else {
      setDevice(null);
    }
  }, [open, actualId]);

  if (!actualId && open) {
    navigate('/devices/new');
    return null;
  }
  if (!device && loading) return null;
  const isView = !!detailId;

  const togglePwd = (id: number) => setShowPwd((prev) => ({ ...prev, [id]: !prev[id] }));

  const acctColumns = [
    {
      title: '账号',
      dataIndex: 'username',
      key: 'username',
      width: 130,
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
      title: '密码',
      dataIndex: 'password',
      key: 'password',
      width: 250,
      render: (pwd: string, record: any) => (
        <Space size={2}>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 12.5,
              padding: '2px 9px',
              borderRadius: 8,
              background: 'rgba(100,116,139,0.09)',
              letterSpacing: showPwd[record.id] ? 0 : 1.5,
              minWidth: 120,
              display: 'inline-block',
            }}
          >
            {showPwd[record.id] ? pwd : '••••••••'}
          </span>
          <Button
            type="text"
            size="small"
            icon={showPwd[record.id] ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            onClick={() => togglePwd(record.id)}
          />
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined />}
            title="复制密码"
            onClick={async () => {
              const ok = await copyText(pwd || '');
              if (ok) message.success('密码已复制');
              else message.error('复制失败');
            }}
          />
        </Space>
      ),
    },
    { title: '备注', dataIndex: 'notes', key: 'notes', render: (v: string) => v || <span style={{ color: 'var(--text-muted)' }}>-</span> },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 170,
      render: (v: string) => (
        <span style={{ fontSize: 12.5, color: 'var(--text-sub)' }}>
          {v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '-'}
        </span>
      ),
    },
  ];

  const addressList = (items: any[]) =>
    items.length === 0 ? (
      <Text type="secondary">暂无记录</Text>
    ) : (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {items.map((it) => (
          <span
            key={it.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 12px',
              borderRadius: 10,
              background: 'rgba(100,116,139,0.07)',
              border: '1px solid var(--line)',
              fontFamily: MONO,
              fontSize: 12.5,
            }}
          >
            {it.address}
            {it.label && <Tag color="blue" style={{ fontSize: 11, marginInlineEnd: 0 }}>{it.label}</Tag>}
          </span>
        ))}
      </div>
    );

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={820}
      title={
        <Space size={10}>
          {isView ? <EyeOutlined style={{ color: 'var(--primary)' }} /> : <EditOutlined style={{ color: 'var(--primary)' }} />}
          <span>{device?.name || '设备详情'}</span>
          {device?.device_type && <Tag color={TYPE_COLORS[device.device_type] || 'default'}>{device.device_type}</Tag>}
          {device?.device_level && <Tag color={LEVEL_COLORS[device.device_level] || 'default'}>{device.device_level}</Tag>}
          {device?.is_network_involved && <Tag color="red">涉网</Tag>}
        </Space>
      }
      footer={
        <Space>
          <Button onClick={onClose}>关闭</Button>
          {isView &&
            canEditDevice(
              JSON.parse(localStorage.getItem('user') || '{}').role,
              device?.device_level || '一级设备',
            ) && (
              <Button
                type="primary"
                className="gradient-btn"
                icon={<EditOutlined />}
                onClick={() => {
                  navigate('/devices/' + actualId + '/edit');
                  onClose();
                }}
              >
                编辑设备
              </Button>
            )}
        </Space>
      }
    >
      {device && (
        <>
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="设备名称">{device.name}</Descriptions.Item>
            <Descriptions.Item label="位置">{device.location || '-'}</Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {device.updated_at ? new Date(device.updated_at).toLocaleString('zh-CN', { hour12: false }) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="账号数量">
              <Tag color="blue">{device.accounts?.length || 0} 个</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="备注" span={2}>
              {device.notes || '-'}
            </Descriptions.Item>
          </Descriptions>

          <SectionTitle icon={<GlobalOutlined />}>IP 地址</SectionTitle>
          {addressList(device.ips || [])}

          <SectionTitle icon={<HddOutlined />}>MAC 地址</SectionTitle>
          {addressList(device.macs || [])}

          <SectionTitle icon={<UserOutlined />}>账号密码</SectionTitle>
          <Table rowKey="id" columns={acctColumns} dataSource={device.accounts || []} pagination={false} size="small" />

          <SectionTitle icon={<PaperClipOutlined />}>附件</SectionTitle>
          {files.length === 0 ? (
            <Text type="secondary">暂无附件</Text>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {files.map((f: any) => (
                <div
                  key={f.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: 'rgba(100,116,139,0.05)',
                    border: '1px solid var(--line)',
                  }}
                >
                  <Space>
                    <span
                      className="icon-badge"
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 9,
                        fontSize: 14,
                        background: 'linear-gradient(135deg,#06b6d4,#3b82f6)',
                        boxShadow: 'none',
                      }}
                    >
                      <FileOutlined />
                    </span>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{f.original_filename}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {f.file_type?.toUpperCase()} · {formatSize(f.file_size)} · {f.upload_by_name}
                      </div>
                    </div>
                  </Space>
                  <Button
                    size="small"
                    type="text"
                    icon={<DownloadOutlined />}
                    onClick={async () => {
                      try {
                        const res = await api.get('/files/' + f.id + '/download', { responseType: 'blob' });
                        const url = URL.createObjectURL(new Blob([res.data]));
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = f.original_filename;
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch {
                        message.error('下载失败');
                      }
                    }}
                  >
                    下载
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
