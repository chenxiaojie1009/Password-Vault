import { useState, useEffect, useMemo } from 'react';
import { Card, Row, Col, Tag, Skeleton, Grid, Button, Tooltip } from 'antd';
import {
  CloudServerOutlined, KeyOutlined, TeamOutlined, FileDoneOutlined,
  DashboardOutlined, ArrowRightOutlined, PlusOutlined, HistoryOutlined,
  CloudServerOutlined as BackupIcon, RocketOutlined, SafetyCertificateOutlined,
  WarningOutlined, ThunderboltOutlined, AuditOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../api/client';
import { PageHeader, StatCard, DonutChart, EmptyState, SectionCard } from '../components/ui';
import { TYPE_COLORS, ACTION_META, STAT_GRADIENTS } from '../constants';

const { useBreakpoint } = Grid;

const TYPE_HEX: Record<string, string> = {
  服务器: '#3b82f6',
  交换机: '#10b981',
  纵加设备: '#f59e0b',
  路由器: '#8b5cf6',
  防火墙: '#ef4444',
  存储设备: '#06b6d4',
  工作站: '#6366f1',
  其他: '#94a3b8',
};
const FALLBACK_HEX = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#6366f1', '#ec4899'];

interface DashData {
  device_count: number;
  account_count: number;
  user_count: number;
  today_logs: number;
  weak_password_count?: number;
  type_stats: Record<string, number>;
  recent_logs: {
    id: number; username: string; action: string; target_type: string; detail: string; created_at: string;
  }[];
}

/** 相对时间：刚刚 / n 分钟前 / n 小时前 / 日期 */
function timeAgo(value: string) {
  const t = dayjs(value);
  const diff = dayjs().diff(t, 'minute');
  if (diff < 1) return '刚刚';
  if (diff < 60) return `${diff} 分钟前`;
  if (diff < 60 * 24) return `${Math.floor(diff / 60)} 小时前`;
  if (diff < 60 * 24 * 7) return `${Math.floor(diff / (60 * 24))} 天前`;
  return t.format('MM-DD HH:mm');
}

export default function Dashboard() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const user = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}'), []);
  const isAdmin = user.role === 'admin';

  useEffect(() => {
    api
      .get('/dashboard')
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const hour = dayjs().hour();
  const greeting = hour < 6 ? '凌晨好' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
  const today = dayjs().format('YYYY年M月D日 dddd');

  const typeEntries = Object.entries(data?.type_stats || {}).sort((a, b) => b[1] - a[1]);
  const totalDevices = data?.device_count || 0;
  const lastLog = data?.recent_logs?.[0];

  const stats = [
    {
      title: '设备总数',
      value: data?.device_count ?? 0,
      icon: <CloudServerOutlined />,
      gradient: STAT_GRADIENTS.blue,
      hint: typeEntries.length ? `涵盖 ${typeEntries.length} 种设备类型` : '暂无设备',
      onClick: () => navigate('/devices'),
    },
    {
      title: '账号总数',
      value: data?.account_count ?? 0,
      icon: <KeyOutlined />,
      gradient: STAT_GRADIENTS.mint,
      hint: totalDevices ? `平均 ${((data?.account_count ?? 0) / totalDevices).toFixed(1)} 个 / 台` : '暂无账号',
      onClick: () => navigate('/devices'),
    },
    {
      title: '用户总数',
      value: data?.user_count ?? 0,
      icon: <TeamOutlined />,
      gradient: STAT_GRADIENTS.sunset,
      hint: '管理员 / 运维 / 编辑 / 查看',
      onClick: isAdmin ? () => navigate('/users') : undefined,
    },
    {
      title: '今日操作',
      value: data?.today_logs ?? 0,
      icon: <FileDoneOutlined />,
      gradient: STAT_GRADIENTS.candy,
      hint: lastLog ? `最近 ${timeAgo(lastLog.created_at)}` : '今日暂无操作',
      onClick: isAdmin ? () => navigate('/audit') : undefined,
    },
  ];

  const quickActions = [
    { key: 'new', title: '添加设备', desc: '录入新的设备与账号密码', icon: <PlusOutlined />, grad: STAT_GRADIENTS.blue, to: '/devices/new', show: user.role !== 'viewer' },
    { key: 'history', title: '密码历史', desc: '查看历次改密记录与旧密码', icon: <HistoryOutlined />, grad: STAT_GRADIENTS.cyan, to: '/history', show: true },
    { key: 'audit', title: '审计日志', desc: '登录与操作行为全程留痕', icon: <AuditOutlined />, grad: STAT_GRADIENTS.mint, to: '/audit', show: isAdmin },
    { key: 'backup', title: '备份与还原', desc: '手动备份或回滚历史数据', icon: <BackupIcon />, grad: STAT_GRADIENTS.candy, to: '/backup', show: isAdmin },
    { key: 'upgrade', title: '系统升级', desc: '上传升级包并自动重启', icon: <RocketOutlined />, grad: STAT_GRADIENTS.sunset, to: '/upgrade', show: isAdmin },
  ].filter((a) => a.show);

  if (loading) {
    return (
      <div>
        <PageHeader icon={<DashboardOutlined />} title="数据概览" subtitle="正在加载统计数据…" />
        <Row gutter={[16, 16]}>
          {[0, 1, 2, 3].map((i) => (
            <Col xs={24} sm={12} lg={6} key={i}>
              <Card className="glass-card" styles={{ body: { padding: 20 } }}>
                <Skeleton active paragraph={{ rows: 1, width: '60%' }} title={{ width: '40%' }} />
              </Card>
            </Col>
          ))}
        </Row>
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={10}>
            <Card className="glass-card" styles={{ body: { padding: 20 } }}>
              <Skeleton active paragraph={{ rows: 5 }} />
            </Card>
          </Col>
          <Col xs={24} lg={14}>
            <Card className="glass-card" styles={{ body: { padding: 20 } }}>
              <Skeleton active paragraph={{ rows: 5 }} />
            </Card>
          </Col>
        </Row>
      </div>
    );
  }

  return (
    <div>
      <PageHeader icon={<DashboardOutlined />} title="数据概览" subtitle="设备与账号集中管理总览" />

      {/* 问候 Hero */}
      <Card
        className="glass-card top-sheen"
        style={{ marginBottom: 16, animation: 'fadeInUp .5s cubic-bezier(0.22,1,0.36,1) both' }}
        styles={{ body: { padding: isMobile ? 18 : 24, position: 'relative', overflow: 'hidden' } }}
      >
        <div
          style={{
            position: 'absolute', right: -70, top: -80, width: 260, height: 260, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.26), transparent 70%)',
            animation: 'floaty 10s ease-in-out infinite', pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute', right: 120, bottom: -110, width: 220, height: 220, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.2), transparent 70%)',
            animation: 'floaty 13s ease-in-out infinite reverse', pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, letterSpacing: -0.3 }}>
              {greeting}，<span className="gradient-text">{user.display_name || user.username}</span>
            </div>
            <div style={{ color: 'var(--text-sub)', fontSize: 13, marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span>{today}</span>
              <span style={{ color: 'var(--line-strong)' }}>|</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span className="status-dot live" /> 服务运行中
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {user.role !== 'viewer' && (
              <Button type="primary" className="gradient-btn" icon={<PlusOutlined />} onClick={() => navigate('/devices/new')}>
                添加设备
              </Button>
            )}
            <Button icon={<HistoryOutlined />} onClick={() => navigate('/history')}>
              密码历史
            </Button>
          </div>
        </div>
      </Card>

      {/* 弱密码提醒 */}
      {(data?.weak_password_count ?? 0) > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 18px',
            marginBottom: 16,
            borderRadius: 14,
            background: 'linear-gradient(100deg, rgba(245,158,11,0.14), rgba(239,68,68,0.1))',
            border: '1px solid rgba(245,158,11,0.32)',
            animation: 'fadeInUp .5s .05s cubic-bezier(0.22,1,0.36,1) both',
          }}
        >
          <span
            className="icon-badge"
            style={{ width: 34, height: 34, borderRadius: 10, fontSize: 16, background: STAT_GRADIENTS.sunset }}
          >
            <WarningOutlined />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              发现 <span style={{ color: '#dc2626' }}>{data?.weak_password_count}</span> 个弱密码账户
            </div>
            <div style={{ color: 'var(--text-sub)', fontSize: 12.5, marginTop: 2 }}>
              建议尽快改为强密码（至少 8 位，包含大小写字母、数字与特殊字符）
            </div>
          </div>
          <Button size="small" type="text" icon={<ArrowRightOutlined />} onClick={() => navigate('/devices')}>
            去处理
          </Button>
        </div>
      )}

      {/* 统计卡片 */}
      <Row gutter={[16, 16]}>
        {stats.map((s, i) => (
          <Col xs={24} sm={12} lg={6} key={s.title}>
            <StatCard {...s} delay={i * 70} />
          </Col>
        ))}
      </Row>

      {/* 类型分布 + 最近活动 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={10}>
          <SectionCard
            icon={<CloudServerOutlined />}
            title="设备类型分布"
            style={{ height: '100%', animation: 'fadeInUp .5s .16s cubic-bezier(0.22,1,0.36,1) both' }}
            bodyStyle={{ paddingTop: 18 }}
          >
            {typeEntries.length === 0 ? (
              <EmptyState
                icon={<CloudServerOutlined />}
                title="暂无设备"
                description="添加第一台设备后，这里会显示类型分布"
                actionText={user.role !== 'viewer' ? '添加设备' : undefined}
                onAction={() => navigate('/devices/new')}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 16 : 26, flexWrap: 'wrap', justifyContent: 'center' }}>
                <DonutChart
                  data={typeEntries.map(([label, value], i) => ({
                    label,
                    value,
                    color: TYPE_HEX[label] || FALLBACK_HEX[i % FALLBACK_HEX.length],
                  }))}
                  size={isMobile ? 160 : 178}
                  centerValue={totalDevices}
                  centerLabel="台设备"
                />
                <div style={{ flex: 1, minWidth: 210 }}>
                  {typeEntries.map(([t, c], i) => {
                    const hex = TYPE_HEX[t] || FALLBACK_HEX[i % FALLBACK_HEX.length];
                    const percent = totalDevices ? Math.round((c / totalDevices) * 100) : 0;
                    return (
                      <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
                        <span style={{ width: 8, height: 8, borderRadius: 3, background: hex, flexShrink: 0 }} />
                        <Tag color={TYPE_COLORS[t] || 'default'} style={{ minWidth: 58, textAlign: 'center', marginInlineEnd: 0 }}>
                          {t}
                        </Tag>
                        <div style={{ flex: 1, height: 7, background: 'rgba(100,116,139,0.12)', borderRadius: 999, overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${percent}%`,
                              height: '100%',
                              borderRadius: 999,
                              background: `linear-gradient(90deg, ${hex}, ${hex}bb)`,
                              transformOrigin: 'left',
                              animation: `barGrow .7s ${0.15 + i * 0.06}s cubic-bezier(0.22,1,0.36,1) both`,
                            }}
                          />
                        </div>
                        <span style={{ color: 'var(--text-sub)', fontSize: 12.5, minWidth: 42, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {c} 台
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </SectionCard>
        </Col>

        <Col xs={24} lg={14}>
          <SectionCard
            icon={<ThunderboltOutlined />}
            title="最近活动"
            extra={
              isAdmin && (
                <Button type="link" size="small" onClick={() => navigate('/audit')}>
                  查看全部 <ArrowRightOutlined />
                </Button>
              )
            }
            style={{ height: '100%', animation: 'fadeInUp .5s .22s cubic-bezier(0.22,1,0.36,1) both' }}
            bodyStyle={{ paddingTop: 10 }}
          >
            {!isAdmin ? (
              <EmptyState icon={<SafetyCertificateOutlined />} title="仅管理员可查看操作日志" compact />
            ) : (data?.recent_logs || []).length === 0 ? (
              <EmptyState icon={<FileDoneOutlined />} title="暂无操作记录" compact />
            ) : (
              <div className="stagger">
                {(data?.recent_logs || []).slice(0, 7).map((log) => {
                  const meta = ACTION_META[log.action] || {
                    label: log.action,
                    color: 'default',
                    gradient: 'linear-gradient(135deg,#94a3b8,#64748b)',
                    icon: <FileDoneOutlined />,
                  };
                  return (
                    <div key={log.id} className="feed-item">
                      <span className="feed-dot" style={{ background: meta.gradient }}>
                        {meta.icon}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: 13.5 }}>{log.username}</span>
                          <Tag color={meta.color} style={{ fontSize: 11 }}>
                            {meta.label}
                          </Tag>
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{log.target_type}</span>
                        </div>
                        <Tooltip title={log.detail}>
                          <div
                            style={{
                              color: 'var(--text-sub)',
                              fontSize: 12.5,
                              marginTop: 3,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {log.detail}
                          </div>
                        </Tooltip>
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {timeAgo(log.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </Col>
      </Row>

      {/* 快捷操作 */}
      {quickActions.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span className="icon-badge" style={{ width: 24, height: 24, borderRadius: 8, fontSize: 12, background: STAT_GRADIENTS.candy }}>
              <ThunderboltOutlined />
            </span>
            <span style={{ fontWeight: 650, fontSize: 15 }}>快捷操作</span>
          </div>
          <Row gutter={[16, 16]}>
            {quickActions.map((a, i) => (
              <Col xs={24} sm={12} lg={6} key={a.key}>
                <Card
                  className="glass-card hover-lift top-sheen"
                  onClick={() => navigate(a.to)}
                  style={{
                    cursor: 'pointer',
                    height: '100%',
                    animation: `fadeInUp .5s ${0.28 + i * 0.06}s cubic-bezier(0.22,1,0.36,1) both`,
                  }}
                  styles={{ body: { padding: 18 } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span className="icon-badge" style={{ width: 42, height: 42, borderRadius: 13, fontSize: 18, background: a.grad }}>
                      {a.icon}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{a.title}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{a.desc}</div>
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}
    </div>
  );
}
