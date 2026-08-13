import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Dropdown, Modal, Form, Input, theme, message, Grid } from 'antd';
const { useBreakpoint } = Grid;
import { DashboardOutlined, HistoryOutlined, AuditOutlined, UserOutlined, MenuFoldOutlined, MenuUnfoldOutlined, TeamOutlined, LogoutOutlined, SettingOutlined, KeyOutlined, CloudServerOutlined, AppstoreOutlined } from '@ant-design/icons';
import api from '../api/client';
import PasswordStrengthMeter from './PasswordStrengthMeter';

const { Header, Sider, Content } = Layout;

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [pwdForm] = Form.useForm();
  const [authed, setAuthed] = useState(() => Boolean(localStorage.getItem('token')));
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { token: themeToken } = theme.useToken();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const newPwd = Form.useWatch('new_password', pwdForm);

  useEffect(() => {
    if (!localStorage.getItem('token')) navigate('/login');
    else setAuthed(true);
  }, [navigate]);

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '数据概览' },
    { key: '/devices', icon: <AppstoreOutlined />, label: '设备列表' },
    { key: '/history', icon: <HistoryOutlined />, label: '密码历史' },
    ...(user.role === 'admin' ? [
      { key: '/audit', icon: <AuditOutlined />, label: '审计日志' },
      { key: '/users', icon: <TeamOutlined />, label: '用户管理' },
      { key: '/backup', icon: <CloudServerOutlined />, label: '备份与还原' }
    ] : []),
  ];

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

  const roleLabel: Record<string, string> = { admin: '管理员', operator: '运维者', editor: '编辑者', viewer: '查看者' };

  const userMenuItems = [
    { key: 'role', label: `身份：${roleLabel[user.role] || user.role}`, disabled: true },
    { type: 'divider' as const },
    { key: 'changepwd', icon: <KeyOutlined />, label: '修改密码' },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
  ];

  const handleUserMenu = ({ key }: { key: string }) => {
    if (key === 'logout') handleLogout();
    if (key === 'changepwd') setPwdModalOpen(true);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} theme="dark" width={224}
        breakpoint="lg" collapsedWidth={0} onBreakpoint={(b) => setCollapsed(b)}
        style={{
          background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 55%, #312e81 100%)',
          boxShadow: '2px 0 16px rgba(15,23,42,0.18)',
          position: 'relative',
          zIndex: 2,
        }}>
        <div style={{
          height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 10, borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            boxShadow: '0 4px 12px rgba(59,130,246,0.5)',
            flexShrink: 0,
          }}>
            <SettingOutlined style={{ fontSize: 18, color: '#fff' }} />
          </div>
          {!collapsed && <span style={{ color: '#fff', fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: 0.5 }}>设备管理器</span>}
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[location.pathname]} items={menuItems} onClick={({ key }) => navigate(key)}
          style={{ background: 'transparent', borderInlineEnd: 'none', paddingTop: 8 }} />
        <div style={{
          position: 'absolute', bottom: 16, left: 16, right: 16,
          padding: '12px 14px', borderRadius: 12,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(6px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, #10b981, #3b82f6)', color: '#fff', fontSize: 13,
            }}>{(user.display_name || user.username || '?').slice(0, 1).toUpperCase()}</div>
            {!collapsed && (
              <div style={{ overflow: 'hidden' }}>
                <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.display_name || user.username}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>{roleLabel[user.role] || user.role}</div>
              </div>
            )}
          </div>
        </div>
      </Sider>
      <Layout>
        <Header style={{
          padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(226,232,240,0.8)', boxShadow: '0 1px 8px rgba(15,23,42,0.05)', zIndex: 1,
        }}>
          <Button type="text" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed(!collapsed)} style={{ fontSize: 16 }} />
          <Dropdown menu={{ items: userMenuItems, onClick: handleUserMenu }}>
            <Button type="text" icon={<UserOutlined />} style={{ fontSize: 14 }}>{user.display_name || user.username}</Button>
          </Dropdown>
        </Header>
        <Content style={{ margin: isMobile ? 4 : 16, padding: isMobile ? 8 : 24, borderRadius: themeToken.borderRadiusLG, minHeight: 280, overflow: 'auto' }}>
          {authed ? <div key={location.pathname} className="page-transition"><Outlet /></div> : null}
        </Content>
      </Layout>

      <Modal title="修改密码" open={pwdModalOpen} onCancel={() => { setPwdModalOpen(false); pwdForm.resetFields(); }} footer={null} width={400}>
        <Form form={pwdForm} onFinish={handleChangePassword} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="old_password" label="当前密码" rules={[{ required: true, message: '请输入当前密码' }]}>
            <Input.Password placeholder="输入当前密码" />
          </Form.Item>
          <Form.Item name="new_password" label="新密码" rules={[
            { required: true, min: 6, message: '至少6位' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || value !== getFieldValue('old_password')) return Promise.resolve();
                return Promise.reject(new Error('新密码不能与旧密码相同'));
              },
            }),
          ]}>
            <Input.Password placeholder="输入新密码（至少6位）" />
          </Form.Item>
          <PasswordStrengthMeter password={newPwd || ''} />
          <Form.Item name="confirm" dependencies={['new_password']} label="确认新密码" rules={[
            { required: true },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('new_password') === value) return Promise.resolve();
                return Promise.reject(new Error('两次密码不一致'));
              },
            }),
          ]}>
            <Input.Password placeholder="再次输入新密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>确认修改</Button>
        </Form>
      </Modal>
    </Layout>
  );
}
