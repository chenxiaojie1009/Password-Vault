import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { appTheme } from './theme';
import AppLayout from './components/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DeviceList from './pages/DeviceList';
import DeviceForm from './pages/DeviceForm';
import PasswordHistory from './pages/PasswordHistory';
import AuditLog from './pages/AuditLog';
import UserManagement from './pages/UserManagement';
import BackupRestore from './pages/BackupRestore';
import SystemUpgrade from './pages/SystemUpgrade';

function App() {
  return (
    <ConfigProvider locale={zhCN} theme={appTheme}>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/devices" element={<DeviceList />} />
            <Route path="/devices/new" element={<DeviceForm />} />
            <Route path="/devices/:id/edit" element={<DeviceForm />} />
            <Route path="/history" element={<PasswordHistory />} />
            <Route path="/audit" element={<AuditLog />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/backup" element={<BackupRestore />} />
            <Route path="/upgrade" element={<SystemUpgrade />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </ConfigProvider>
  );
}

export default App;
