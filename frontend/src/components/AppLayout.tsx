import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Dropdown, theme, message } from 'antd';
import { DashboardOutlined, HistoryOutlined, AuditOutlined, UserOutlined, MenuFoldOutlined, MenuUnfoldOutlined, TeamOutlined, LogoutOutlined, SettingOutlined } from '@ant-design/icons';

const { Header, Sider, Content } = Layout;

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { token: themeToken } = theme.useToken();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    if (!localStorage.getItem('token')) navigate('/login');
  }, [navigate]);

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '设备列表' },
    { key: '/history', icon: <HistoryOutlined />, label: '密码历史' },
    { key: '/audit', icon: <AuditOutlined />, label: '审计日志' },
    ...(user.role === 'admin' ? [{ key: '/users', icon: <TeamOutlined />, label: '用户管理' }] : []),
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    message.success('已退出登录');
    navigate('/login');
  };

  const roleLabel: Record<string, string> = { admin: '管理员', editor: '编辑者', viewer: '查看者' };

  const userMenuItems = [
    { key: 'role', label: `身份：${roleLabel[user.role] || user.role}`, disabled: true },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} theme="dark" width={220}
        style={{ background: 'linear-gradient(180deg, #001529 0%, #002140 100%)' }}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <SettingOutlined style={{ fontSize: collapsed ? 20 : 24, color: '#1890ff' }} />
          {!collapsed && <span style={{ color: '#fff', marginLeft: 10, fontSize: 16, fontWeight: 600, whiteSpace: 'nowrap' }}>设备管理器</span>}
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[location.pathname]} items={menuItems} onClick={({ key }) => navigate(key)} />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 24px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', zIndex: 1 }}>
          <Button type="text" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed(!collapsed)} style={{ fontSize: 16 }} />
          <Dropdown menu={{ items: userMenuItems, onClick: ({ key }) => { if (key === 'logout') handleLogout(); } }}>
            <Button type="text" icon={<UserOutlined />} style={{ fontSize: 14 }}>{user.display_name || user.username}</Button>
          </Dropdown>
        </Header>
        <Content style={{ margin: 16, padding: 24, background: '#fff', borderRadius: themeToken.borderRadiusLG, minHeight: 280, overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
