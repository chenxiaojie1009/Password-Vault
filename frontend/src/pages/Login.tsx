import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, message, Modal, Tooltip, Checkbox, Grid, Divider } from 'antd';
import {
  UserOutlined, LockOutlined, SafetyCertificateOutlined, ThunderboltOutlined,
  KeyOutlined, AuditOutlined, CloudServerOutlined, TeamOutlined, ArrowRightOutlined,
} from '@ant-design/icons';
import api from '../api/client';
import { generatePassword } from '../utils';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';

const { Text } = Typography;
const { useBreakpoint } = Grid;

const FEATURES = [
  { icon: <KeyOutlined />, title: '密码加密存储', desc: 'Fernet 对称加密，解密查看受权限约束', grad: 'linear-gradient(135deg,#3b82f6,#6366f1)' },
  { icon: <TeamOutlined />, title: '四级权限管控', desc: '设备分级 + 涉网设备隔离查看', grad: 'linear-gradient(135deg,#10b981,#059669)' },
  { icon: <AuditOutlined />, title: '全量审计留痕', desc: '登录、增删改、导出操作全程可追溯', grad: 'linear-gradient(135deg,#f59e0b,#ea580c)' },
  { icon: <CloudServerOutlined />, title: '一键备份还原', desc: '每日凌晨自动备份，随时回滚历史版本', grad: 'linear-gradient(135deg,#8b5cf6,#ec4899)' },
];

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [changePwdOpen, setChangePwdOpen] = useState(false);
  const [loginUser, setLoginUser] = useState({ username: '', display_name: '' });
  const [form] = Form.useForm();
  const [changePwdForm] = Form.useForm();
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const showBrand = !!screens.lg;
  const newPwd = Form.useWatch('new_password', changePwdForm);

  const doLogin = async (values: { username: string; password: string; remember?: boolean }) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', values);
      const data = res.data;
      localStorage.setItem('token', data.access_token);
      localStorage.setItem(
        'user',
        JSON.stringify({ username: data.username, display_name: data.display_name, role: data.role }),
      );
      if (values.remember) localStorage.setItem('remembered_username', data.username);
      else localStorage.removeItem('remembered_username');

      if (data.must_change_password) {
        setLoginUser({ username: data.username, display_name: data.display_name });
        setChangePwdOpen(true);
      } else {
        message.success('欢迎回来，' + (data.display_name || data.username));
        navigate('/');
      }
    } catch (err: any) {
      message.error(err.response?.data?.detail || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (values: { old_password: string; new_password: string }) => {
    try {
      await api.post('/auth/change-password', values);
      message.success('密码修改成功，请重新登录');
      setChangePwdOpen(false);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      form.resetFields();
    } catch (err: any) {
      message.error(err.response?.data?.detail || '修改失败');
    }
  };

  return (
    <>
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg,#0b1225 0%,#171a3f 45%,#2a1f5c 100%)',
        }}
      >
        {/* 网格光晕 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.085) 1px, transparent 1px)',
            backgroundSize: '34px 34px',
            maskImage: 'radial-gradient(ellipse 75% 65% at 50% 45%, black 25%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse 75% 65% at 50% 45%, black 25%, transparent 75%)',
            pointerEvents: 'none',
          }}
        />
        {/* 漂浮光斑 */}
        <div
          style={{
            position: 'absolute', width: 360, height: 360, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.42), transparent 70%)',
            top: '4%', left: '6%', animation: 'drift 16s ease-in-out infinite', pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute', width: 300, height: 300, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.4), transparent 70%)',
            bottom: '6%', right: '10%', animation: 'drift 20s ease-in-out infinite reverse', pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute', width: 220, height: 220, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16,185,129,0.28), transparent 70%)',
            top: '58%', left: '24%', animation: 'drift 13s ease-in-out infinite 2s', pointerEvents: 'none',
          }}
        />

        {/* 左侧品牌区 */}
        {showBrand && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '0 clamp(32px, 6vw, 96px)',
              position: 'relative',
              zIndex: 2,
              maxWidth: 720,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, animation: 'slideInLeft .6s cubic-bezier(0.22,1,0.36,1) both' }}>
              <div
                className="icon-badge"
                style={{
                  width: 56, height: 56, borderRadius: 18, fontSize: 26,
                  background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
                  boxShadow: '0 14px 36px rgba(99,102,241,0.55)',
                }}
              >
                <SafetyCertificateOutlined />
              </div>
              <div>
                <div style={{ color: '#fff', fontSize: 26, fontWeight: 700, letterSpacing: 1 }}>设备管理器</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, letterSpacing: 2.4 }}>DEVICE MANAGER</div>
              </div>
            </div>

            <div
              style={{
                marginTop: 28, color: 'rgba(255,255,255,0.86)', fontSize: 17, lineHeight: 1.7,
                animation: 'slideInLeft .6s .08s cubic-bezier(0.22,1,0.36,1) both',
              }}
            >
              内网服务器、交换机、路由器等设备的
              <span style={{ color: '#a5b4fc', fontWeight: 600 }}>账号密码集中管理平台</span>
            </div>

            <div style={{ marginTop: 34, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {FEATURES.map((f, i) => (
                <div
                  key={f.title}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 16px', borderRadius: 16,
                    background: 'rgba(255,255,255,0.055)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(8px)',
                    animation: `slideInLeft .6s ${0.16 + i * 0.08}s cubic-bezier(0.22,1,0.36,1) both`,
                    transition: 'transform .26s cubic-bezier(0.22,1,0.36,1), background .26s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateX(6px)';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.09)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.055)';
                  }}
                >
                  <span
                    className="icon-badge"
                    style={{ width: 38, height: 38, borderRadius: 12, fontSize: 17, background: f.grad }}
                  >
                    {f.icon}
                  </span>
                  <div>
                    <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{f.title}</div>
                    <div style={{ color: 'rgba(255,255,255,0.48)', fontSize: 12.5, marginTop: 2 }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 右侧登录卡片 */}
        <div
          style={{
            width: showBrand ? 520 : '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: showBrand ? '0 64px 0 24px' : '0 20px',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <Card
            className="glass-strong"
            style={{
              width: '100%',
              maxWidth: 420,
              borderRadius: 22,
              boxShadow: '0 28px 80px rgba(2,6,23,0.55)',
              animation: 'scaleIn .55s cubic-bezier(0.22,1,0.36,1) both',
            }}
            styles={{ body: { padding: '38px 34px 30px' } }}
          >
            <div style={{ textAlign: 'center', marginBottom: 26 }}>
              <div
                className="icon-badge"
                style={{
                  width: 62, height: 62, margin: '0 auto 14px', borderRadius: 20, fontSize: 30,
                  background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
                  boxShadow: '0 14px 34px rgba(59,130,246,0.5)',
                  animation: 'floaty 5.5s ease-in-out infinite',
                }}
              >
                <SafetyCertificateOutlined />
              </div>
              <div style={{ fontSize: 22, fontWeight: 700 }} className="gradient-text">
                欢迎回来
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>
                登录后继续管理内网设备凭据
              </div>
            </div>

            <Form
              name="login"
              form={form}
              onFinish={doLogin}
              size="large"
              initialValues={{ remember: true, username: localStorage.getItem('remembered_username') || '' }}
            >
              <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
                <Input prefix={<UserOutlined />} placeholder="用户名" autoComplete="username" />
              </Form.Item>
              <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
                <Input.Password prefix={<LockOutlined />} placeholder="密码" autoComplete="current-password" />
              </Form.Item>
              <Form.Item name="remember" valuePropName="checked" style={{ marginBottom: 18 }}>
                <Checkbox style={{ color: 'var(--text-sub)', fontSize: 13 }}>记住用户名</Checkbox>
              </Form.Item>
              <Form.Item style={{ marginBottom: 14 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  className="gradient-btn"
                  style={{ height: 48, fontSize: 15, letterSpacing: 4, borderRadius: 12 }}
                  icon={loading ? undefined : <ArrowRightOutlined />}
                  iconPosition="end"
                >
                  登 录
                </Button>
              </Form.Item>
            </Form>

            <Divider style={{ margin: '18px 0 14px' }} plain />
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.9 }}>
              首次登录需修改默认密码
              <br />
              所有操作均记录审计日志
            </div>
          </Card>
        </div>
      </div>

      <Modal
        title="首次登录 — 修改密码"
        open={changePwdOpen}
        closable={false}
        footer={null}
        width={420}
      >
        <div style={{ marginBottom: 16 }}>
          <Text>
            欢迎 <strong>{loginUser.display_name || loginUser.username}</strong>，首次登录请修改默认密码：
          </Text>
        </div>
        <Form onFinish={handleChangePassword} form={changePwdForm} layout="vertical">
          <Form.Item name="old_password" label="当前密码" rules={[{ required: true, message: '请输入当前密码' }]}>
            <Input.Password prefix={<KeyOutlined />} placeholder="当前密码" />
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
                      changePwdForm.setFieldValue('new_password', pwd);
                      changePwdForm.setFieldValue('confirm', pwd);
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
            <Input.Password prefix={<LockOutlined />} placeholder="输入新密码（至少6位）" />
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
            <Input.Password prefix={<LockOutlined />} placeholder="再次输入新密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block className="gradient-btn">
            确认修改
          </Button>
        </Form>
      </Modal>
    </>
  );
}
