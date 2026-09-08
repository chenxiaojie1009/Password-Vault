import { useState, useEffect, useRef } from 'react';
import { Card, Button, Space, Typography, message, Upload, Descriptions, Tag, Modal, Spin, Result } from 'antd';
import {
  CloudUploadOutlined, RocketOutlined, ReloadOutlined, UndoOutlined, ThunderboltOutlined,
  CheckCircleOutlined, DatabaseOutlined, DesktopOutlined, SafetyCertificateOutlined, HistoryOutlined,
} from '@ant-design/icons';
import api from '../api/client';
import { PageHeader, SectionCard } from '../components/ui';

const { Text } = Typography;
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

interface UpgradeInfo {
  current_version: string;
  frozen: boolean;
  base_dir: string;
  applying: boolean;
  staged: null | {
    version: string;
    changelog: string;
    size_bytes: number;
    uploaded_at: string;
  };
}

const STEPS = [
  { icon: <CloudUploadOutlined />, title: '上传升级包', desc: 'zip 内含新的 DeviceManager.exe 与 version.json' },
  { icon: <DatabaseOutlined />, title: '自动备份', desc: '升级前自动备份数据库与 uploads 附件目录' },
  { icon: <ThunderboltOutlined />, title: '替换重启', desc: '替换程序文件后自动重启服务，旧程序留档' },
  { icon: <SafetyCertificateOutlined />, title: '数据零丢失', desc: '数据库与附件原样保留，可随时回滚' },
];

export default function SystemUpgrade() {
  const [info, setInfo] = useState<UpgradeInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyDone, setApplyDone] = useState(false);
  const pollTimer = useRef<any>(null);

  const fetchInfo = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await api.get('/upgrade/info');
      setInfo(r.data);
      return r.data as UpgradeInfo;
    } catch {
      if (!silent) message.error('获取升级信息失败');
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchInfo();
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  const handleUpload = async (file: File): Promise<false> => {
    const fd = new FormData();
    fd.append('file', file);
    setUploading(true);
    try {
      const r = await api.post('/upgrade/upload', fd, { timeout: 300000 });
      message.success(`升级包上传成功：v${r.data.version}`);
      fetchInfo(true);
    } catch (err: any) {
      message.error(err.response?.data?.detail || '上传失败');
    } finally {
      setUploading(false);
    }
    return false;
  };

  const handleApply = async () => {
    setApplying(true);
    setApplyDone(false);
    try {
      const r = await api.post('/upgrade/apply');
      message.success(r.data.message || '升级已开始');
      let tries = 0;
      pollTimer.current = setInterval(async () => {
        tries += 1;
        try {
          const res = await api.get('/upgrade/info', { timeout: 5000 });
          const d = res.data as UpgradeInfo;
          if (!d.applying && d.current_version) {
            clearInterval(pollTimer.current);
            setApplying(false);
            setApplyDone(true);
            fetchInfo(true);
          }
        } catch {
          // 服务重启中，连接失败属正常
        }
        if (tries > 40) {
          clearInterval(pollTimer.current);
          setApplying(false);
          message.warning('等待超时，请手动刷新页面确认升级结果');
        }
      }, 5000);
    } catch (err: any) {
      setApplying(false);
      message.error(err.response?.data?.detail || '升级启动失败');
    }
  };

  const handleCancel = async () => {
    try {
      await api.post('/upgrade/cancel');
      message.success('已取消待升级包');
      fetchInfo(true);
    } catch {
      message.error('取消失败');
    }
  };

  const fmtSize = (b: number) => (b / 1024 / 1024).toFixed(1) + ' MB';

  const infoTile = (icon: React.ReactNode, label: string, value: React.ReactNode) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        borderRadius: 14,
        background: 'rgba(100,116,139,0.05)',
        border: '1px solid var(--line)',
      }}
    >
      <span
        className="icon-badge"
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          fontSize: 17,
          background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
          boxShadow: 'none',
        }}
      >
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{label}</div>
        <div style={{ fontWeight: 600, fontSize: 14, marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader
        icon={<ThunderboltOutlined />}
        gradient="linear-gradient(135deg,#10b981,#3b82f6)"
        title="系统升级"
        subtitle="上传升级包，自动备份数据并替换程序"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => fetchInfo()} loading={loading}>
            刷新
          </Button>
        }
      />

      <Card className="glass-card" style={{ marginBottom: 16 }} styles={{ body: { padding: 20 } }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {STEPS.map((s, i) => (
            <div key={s.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span
                className="icon-badge"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 11,
                  fontSize: 16,
                  background: 'linear-gradient(135deg,#10b981,#3b82f6)',
                  boxShadow: 'none',
                }}
              >
                {s.icon}
              </span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                  <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>{i + 1}.</span>
                  {s.title}
                </div>
                <div style={{ color: 'var(--text-sub)', fontSize: 12.5, marginTop: 3, lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <SectionCard
        icon={<DesktopOutlined />}
        title="当前版本"
        style={{ marginBottom: 16 }}
        bodyStyle={{ paddingTop: 16 }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
          {infoTile(
            <RocketOutlined />,
            '当前版本',
            <Tag color="blue" style={{ fontSize: 13, padding: '1px 12px' }}>
              v{info?.current_version || '-'}
            </Tag>,
          )}
          {infoTile(<DesktopOutlined />, '运行环境', info?.frozen ? <Tag color="green">独立程序 (EXE)</Tag> : <Tag>开发模式</Tag>)}
          {infoTile(
            <ThunderboltOutlined />,
            '升级状态',
            info?.applying ? <Tag color="orange">升级进行中</Tag> : <Tag color="default">正常</Tag>,
          )}
          {infoTile(<DatabaseOutlined />, '运行目录', <Text style={{ fontSize: 12, fontFamily: MONO }} copyable>{info?.base_dir || '-'}</Text>)}
        </div>
      </SectionCard>

      <SectionCard
        icon={<CloudUploadOutlined />}
        title="上传升级包"
        style={{ marginBottom: 16 }}
        bodyStyle={{ paddingTop: 16 }}
      >
        <Upload.Dragger
          accept=".zip"
          maxCount={1}
          showUploadList={false}
          disabled={!!info?.staged || uploading}
          beforeUpload={handleUpload as any}
        >
          <p className="ant-upload-drag-icon">
            <CloudUploadOutlined style={{ color: 'var(--primary)' }} />
          </p>
          <p className="ant-upload-text">点击或拖拽上传升级包（.zip）</p>
          <p className="ant-upload-hint">
            升级包需包含：DeviceManager.exe（新版本程序）+ version.json（版本信息）
            <br />
            {info?.staged ? '已有待升级包，请先取消或直接升级' : '文件最大 300MB'}
          </p>
        </Upload.Dragger>
      </SectionCard>

      {info?.staged && (
        <Card
          className="glass-card top-sheen"
          style={{
            marginBottom: 16,
            borderColor: 'rgba(16,185,129,0.45)',
            boxShadow: '0 12px 32px rgba(16,185,129,0.14)',
            animation: 'fadeInUp .45s cubic-bezier(0.22,1,0.36,1) both',
          }}
          title={
            <Space>
              <CheckCircleOutlined style={{ color: '#10b981' }} /> 待升级包已就绪
            </Space>
          }
          styles={{ body: { paddingTop: 14 } }}
        >
          <Descriptions size="small" column={{ xs: 1, sm: 3 }} style={{ marginBottom: 14 }}>
            <Descriptions.Item label="新版本">
              <Tag color="green" style={{ fontSize: 14 }}>
                v{info.staged.version}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="大小">{fmtSize(info.staged.size_bytes)}</Descriptions.Item>
            <Descriptions.Item label="上传时间">{info.staged.uploaded_at}</Descriptions.Item>
          </Descriptions>

          {info.staged.changelog && (
            <div
              style={{
                marginBottom: 16,
                padding: '14px 16px',
                borderRadius: 14,
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.25)',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#047857' }}>
                <HistoryOutlined /> 更新说明
              </div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.7 }}>
                {info.staged.changelog}
              </div>
            </div>
          )}

          <Space wrap>
            <Button
              type="primary"
              className="gradient-btn"
              icon={<RocketOutlined />}
              size="large"
              loading={applying}
              onClick={handleApply}
            >
              立即升级
            </Button>
            <Button icon={<UndoOutlined />} disabled={applying} onClick={handleCancel}>
              取消升级包
            </Button>
          </Space>
        </Card>
      )}

      <Modal open={applying} footer={null} closable={false} width={380}>
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 18, fontWeight: 600, fontSize: 16 }}>正在升级…</div>
          <div style={{ marginTop: 8, color: 'var(--text-sub)', fontSize: 13, lineHeight: 1.8 }}>
            数据已自动备份，正在替换程序文件并重启服务
            <br />
            请勿关闭页面
          </div>
        </div>
      </Modal>

      <Modal open={applyDone} footer={null} closable={false} width={400}>
        <Result
          status="success"
          title="升级完成"
          subTitle={
            <>
              服务已重启，当前版本{' '}
              <Tag color="green">v{info?.current_version || '-'}</Tag>
            </>
          }
          extra={
            <Button type="primary" onClick={() => window.location.reload()}>
              刷新页面
            </Button>
          }
        />
      </Modal>
    </div>
  );
}
