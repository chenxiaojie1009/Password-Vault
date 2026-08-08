import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppLayout from './components/AppLayout';
import Login from './pages/Login';
import DeviceList from './pages/DeviceList';
import DeviceForm from './pages/DeviceForm';
import PasswordHistory from './pages/PasswordHistory';
import AuditLog from './pages/AuditLog';
import UserManagement from './pages/UserManagement';
import BackupRestore from './pages/BackupRestore';

function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#3b82f6',
          colorLink: '#3b82f6',
          colorInfo: '#3b82f6',
          colorSuccess: '#10b981',
          colorWarning: '#f59e0b',
          colorError: '#ef4444',
          borderRadius: 8,
          colorBgLayout: '#f4f6fb',
          colorTextBase: '#1f2937',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif",
        },
        components: {
          Card: {
            borderRadiusLG: 14,
            boxShadowTertiary: '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
          },
          Table: {
            headerBg: '#f8fafc',
            headerColor: '#64748b',
            rowHoverBg: '#f0f7ff',
          },
          Layout: {
            headerBg: 'rgba(255,255,255,0.85)',
            siderBg: 'transparent',
          },
          Menu: {
            darkItemBg: 'transparent',
            darkItemSelectedBg: 'rgba(59,130,246,0.2)',
            darkItemHoverBg: 'rgba(255,255,255,0.08)',
          },
          Modal: {
            borderRadiusLG: 14,
          },
          Button: {
            primaryShadow: '0 6px 16px rgba(59,130,246,0.3)',
          },
          Pagination: {
            borderRadius: 8,
          },
        },
      }}
    >
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<DeviceList />} />
            <Route path="/devices/new" element={<DeviceForm />} />
            <Route path="/devices/:id/edit" element={<DeviceForm />} />
            <Route path="/history" element={<PasswordHistory />} />
            <Route path="/audit" element={<AuditLog />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/backup" element={<BackupRestore />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </ConfigProvider>
  );
}

export default App;
