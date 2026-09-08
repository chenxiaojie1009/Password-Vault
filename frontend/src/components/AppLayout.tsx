import { useState, useEffect, useMemo, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Layout, Menu, Button, Dropdown, Modal, Form, Input, message, Grid, Tooltip, Drawer,
  Select, Tag, Avatar, Breadcrumb,
} from 'antd';
const { useBreakpoint } = Grid;
import {
  DashboardOutlined, HistoryOutlined, AuditOutlined, MenuFoldOutlined,
  MenuUnfoldOutlined, TeamOutlined, LogoutOutlined, KeyOutlined,
  CloudServerOutlined, AppstoreOutlined, ThunderboltOutlined, RocketOutlined,
  SearchOutlined, SafetyCertificateOutlined, ArrowRightOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/client';
import { generatePassword } from '../utils';
import { ROLE_COLORS, ROLE_LABELS } from '../constants';
import PasswordStrengthMeter from './PasswordStrengthMeter';

const { Header, Sider, Content } = Layout;

interface NavItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  admin?: boolean;
}

const NAV: NavItem[] = [
  { key: '/', icon: <DashboardOutlined />, label: '数据概览' },
  { key: '/devices', icon: <AppstoreOutlined />, label: '设备列表' },
  { key: '/history', icon: <HistoryOutlined />, label: '密码历史' },
  { key: '/audit', icon: <AuditOutlined />, label: '审计日志', admin: true },
  { key: '/users', icon: <TeamOutlined />, label: '用户管理', admin: true },
  { key: '/backup', icon: <CloudServerOutlined />, label: '备份与还原', admin: true },
  { key: '/upgrade', icon: <RocketOutlined />, label: '系统升级', admin: true },
];

const PAGE_META: Record<string, { title: string; parent?: string }> = {
  '/': { title: '数据概览' },
  '/devices': { title: '设备列表' },
  '/devices/new': { title: '添加设备', parent: '设备列表' },
  '/history': { title: '密码历史' },
  '/audit': { title: '审计日志' },
  '/users': { title: '用户管理' },
  '/backup': { title: '备份与还原' },
  '/upgrade': { title: '系统升级' },
};

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [pwdForm] = Form.useForm();
  const [authed, setAuthed] = useState(() => Boolean(localStorage.getItem('token')));
  const [now, setNow] = useState(() => dayjs());
  const [quickNav, setQuickNav] = useState<string | undefined>(undefined);
  const searchRef = useRef<any>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const user = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}'), []);
  const newPwd = Form.useWatch('new_password', pwdForm);

  useEffect(() => {
    if (!localStorage.getItem('token')) navigate('/login');
    else setAuthed(true);
  }, [navigate]);

  // 顶部时钟
  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Ctrl/Cmd + K 聚焦快速跳转
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const menuItems = useMemo(
    () => NAV.filter((i) => !i.admin || user.role === 'admin').map(({ key, icon, label }) => ({ key, icon, label })),
    [user.role],
  );

  const pageMeta = useMemo(() => {
    if (/^\/devices\/\d+\/edit$/.test(location.pathname)) return { title: '编辑设备', parent: '设备列表' };
    return PAGE_META[location.pathname] || { title: '设备管理器' };
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    message.success('已退出登录');
    navigate('/login');
  };

  const handleChangePassword = async (values: { old_password: string; new_password: string }) => {
    try {
      await api.post('/auth/change-password', values);
      message.success('密码修改成功');
      setPwdModalOpen(false);
      pwdForm.resetFields();
    } catch (err: any) {
      message.error(err.response?.data?.detail || '修改失败');
    }
  };

  const userMenuItems = [
    { key: 'role', label: `身份：${ROLE_LABELS[user.role] || user.role}`, disabled: true },
    { type: 'divider' as const },
    { key: 'changepwd', icon: <KeyOutlined />, label: '修改密码' },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
  ];

  const handleUserMenu = ({ key }: { key: string }) => {
    if (key === 'logout') handleLogout();
    if (key === 'changepwd') setPwdModalOpen(true);
  };

  const go = (key: string) => {
    navigate(key);
    setDrawerOpen(false);
  };

  /* ------------------------------ 侧边导航 ------------------------------ */
  const sideNav = (isCollapsed: boolean) => (
    <>
      <div
        className="sider-logo"
        style={{
          height: 62,
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          gap: 10,
          padding: isCollapsed ? 0 : '0 18px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}
      >
        <div
          className="icon-badge"
          style={{
            width: 34,
            height: 34,
            borderRadius: 11,
            background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
            boxShadow: '0 6px 16px rgba(99,102,241,0.55)',
            fontSize: 17,
          }}
        >
          <SafetyCertificateOutlined />
        </div>
        {!isCollapsed && (
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, letterSpacing: 0.4, whiteSpace: 'nowrap' }}>
              设备管理器
            </div>
            <div style={{ color: 'rgba(255,255,255,0.42)', fontSize: 11, letterSpacing: 0.6 }}>DEVICE MANAGER</div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingTop: 10 }}>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => go(key)}
          style={{ background: 'transparent', borderInlineEnd: 'none' }}
        />
      </div>

      <div
        style={{
          margin: isCollapsed ? '0 12px 16px' : '0 14px 16px',
          padding: isCollapsed ? '10px 0' : '12px 14px',
          borderRadius: 14,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.09)',
          backdropFilter: 'blur(8px)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
          <Avatar
            size={32}
            style={{
              background: 'linear-gradient(135deg,#10b981,#3b82f6)',
              fontSize: 14,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {(user.display_name || user.username || '?').slice(0, 1).toUpperCase()}
          </Avatar>
          {!isCollapsed && (
            <>
              <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {user.display_name || user.username}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
                  {ROLE_LABELS[user.role] || user.role}
                </div>
              </div>
              <Tooltip title="退出登录">
                <Button
                  type="text"
                  size="small"
                  icon={<LogoutOutlined />}
                  onClick={handleLogout}
                  style={{ color: 'rgba(255,255,255,0.55)' }}
                />
              </Tooltip>
            </>
          )}
        </div>
      </div>
    </>
  );

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      {isMobile ? (
        <Drawer
          placement="left"
          width={248}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          closable={false}
          styles={{
            body: { padding: 0, background: 'var(--sider-bg)', display: 'flex', flexDirection: 'column' },
            wrapper: { boxShadow: '0 0 60px rgba(2,6,23,0.5)' },
          }}
        >
          {sideNav(false)}
        </Drawer>
      ) : (
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          theme="dark"
          width={232}
          className="app-sider"
          style={{
            background: 'var(--sider-bg)',
            boxShadow: '2px 0 24px rgba(15,23,42,0.18)',
            position: 'sticky',
            top: 0,
            height: '100vh',
            overflow: 'hidden',
          }}
        >
          {sideNav(collapsed)}
        </Sider>
      )}

      <Layout style={{ background: 'transparent' }}>
        <Header
          className="app-header"
          style={{
            padding: isMobile ? '0 12px' : '0 22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            background: 'rgba(255,255,255,0.82)',
            backdropFilter: 'blur(16px) saturate(160%)',
            WebkitBackdropFilter: 'blur(16px) saturate(160%)',
            borderBottom: '1px solid rgba(226,232,240,0.9)',
            boxShadow: '0 1px 12px rgba(15,23,42,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <Button
              type="text"
              icon={isMobile || collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => (isMobile ? setDrawerOpen(true) : setCollapsed(!collapsed))}
              style={{ fontSize: 16 }}
              aria-label="切换导航"
            />
            <Breadcrumb
              items={[
                ...(pageMeta.parent ? [{ title: pageMeta.parent }] : []),
                { title: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{pageMeta.title}</span> },
              ]}
              style={{ fontSize: 13 }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!isMobile && (
              <Select
                ref={searchRef}
                showSearch
                variant="filled"
                placeholder="快速跳转页面"
                suffixIcon={
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span className="kbd">Ctrl</span>
                    <span className="kbd">K</span>
                  </span>
                }
                prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
                style={{ width: 208 }}
                options={menuItems.map((m) => ({ label: m.label, value: m.key }))}
                filterOption={(input, option) =>
                  String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                onSelect={(v) => {
                  go(v as string);
                  setQuickNav(undefined);
                }}
                value={quickNav}
              />
            )}
            {!isMobile && (
              <Tooltip title="当前时间（北京时间）">
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    fontSize: 12.5,
                    color: 'var(--text-sub)',
                    padding: '5px 11px',
                    borderRadius: 999,
                    background: 'rgba(100,116,139,0.07)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <span className="status-dot live" />
                  {now.format('HH:mm:ss')}
                </span>
              </Tooltip>
            )}
            <Dropdown menu={{ items: userMenuItems, onClick: handleUserMenu }} placement="bottomRight">
              <Button
                type="text"
                style={{ display: 'flex', alignItems: 'center', gap: 8, paddingInline: 6, height: 38, borderRadius: 10 }}
              >
                <Avatar size={28} style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', fontSize: 13 }}>
                  {(user.display_name || user.username || '?').slice(0, 1).toUpperCase()}
                </Avatar>
                {!isMobile && <span style={{ fontWeight: 500 }}>{user.display_name || user.username}</span>}
                {!isMobile && (
                  <Tag color={ROLE_COLORS[user.role]} style={{ marginInlineEnd: 0, fontSize: 11 }}>
                    {ROLE_LABELS[user.role] || user.role}
                  </Tag>
                )}
              </Button>
            </Dropdown>
          </div>
        </Header>

        <Content
          style={{
            margin: isMobile ? 0 : 18,
            marginBottom: isMobile ? 8 : 24,
            padding: isMobile ? '14px 12px 20px' : '22px 24px 28px',
            borderRadius: isMobile ? 0 : 'var(--radius-lg)',
            minHeight: 280,
            overflow: 'visible',
          }}
        >
          <div className="content-shell">
            {authed ? (
              <div key={location.pathname} className="page-transition">
                <Outlet />
              </div>
            ) : null}
          </div>
        </Content>
      </Layout>

      <Modal
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <KeyOutlined style={{ color: 'var(--primary)' }} /> 修改密码
          </span>
        }
        open={pwdModalOpen}
        onCancel={() => {
          setPwdModalOpen(false);
          pwdForm.resetFields();
        }}
        footer={null}
        width={420}
      >
        <Form form={pwdForm} onFinish={handleChangePassword} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="old_password" label="当前密码" rules={[{ required: true, message: '请输入当前密码' }]}>
            <Input.Password prefix={<KeyOutlined />} placeholder="输入当前密码" />
          </Form.Item>
          <Form.Item
            name="new_password"
            label={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                新密码
                <Tooltip title="生成强密码">
                  <Button
                    size="small"
                    type="link"
                    icon={<ThunderboltOutlined />}
                    style={{ padding: 0 }}
                    onClick={() => {
                      const pwd = generatePassword();
                      pwdForm.setFieldValue('new_password', pwd);
                      pwdForm.setFieldValue('confirm', pwd);
                    }}
                  />
                </Tooltip>
              </span>
            }
            rules={[
              { required: true, min: 6, message: '至少6位' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || value !== getFieldValue('old_password')) return Promise.resolve();
                  return Promise.reject(new Error('新密码不能与旧密码相同'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<SafetyCertificateOutlined />} placeholder="输入新密码（至少6位）" />
          </Form.Item>
          <PasswordStrengthMeter password={newPwd || ''} />
          <Form.Item
            name="confirm"
            dependencies={['new_password']}
            label="确认新密码"
            style={{ marginTop: 14 }}
            rules={[
              { required: true },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) return Promise.resolve();
                  return Promise.reject(new Error('两次密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<SafetyCertificateOutlined />} placeholder="再次输入新密码" />
          </Form.Item>
          <Button type="primary" className="gradient-btn" htmlType="submit" block icon={<ArrowRightOutlined />}>
            确认修改
          </Button>
        </Form>
      </Modal>
    </Layout>
  );
}
