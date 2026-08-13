import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Form, Input, Button, Typography, message, Modal } from "antd";
import { UserOutlined, LockOutlined, SafetyOutlined } from "@ant-design/icons";
import api from "../api/client";
import PasswordStrengthMeter from "../components/PasswordStrengthMeter";

const { Title, Text } = Typography;

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [changePwdOpen, setChangePwdOpen] = useState(false);
  const [loginUser, setLoginUser] = useState({ username: "", display_name: "" });
  const [form] = Form.useForm();
  const [changePwdForm] = Form.useForm();
  const navigate = useNavigate();
  const newPwd = Form.useWatch("new_password", changePwdForm);

  const doLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const res = await api.post("/auth/login", values);
      const data = res.data;
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify({
        username: data.username, display_name: data.display_name, role: data.role,
      }));

      if (data.must_change_password) {
        setLoginUser({ username: data.username, display_name: data.display_name });
        setChangePwdOpen(true);
      } else {
        message.success("欢迎回来，" + (data.display_name || data.username));
        navigate("/");
      }
    } catch (err: any) {
      message.error(err.response?.data?.detail || "登录失败");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (values: { old_password: string; new_password: string }) => {
    try {
      await api.post("/auth/change-password", values);
      message.success("密码修改成功，请重新登录");
      setChangePwdOpen(false);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      form.resetFields();
    } catch (err: any) {
      message.error(err.response?.data?.detail || "修改失败");
    }
  };

  return (
    <>
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative", overflow: "hidden",
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 45%, #312e81 75%, #4338ca 100%)",
        backgroundSize: "220% 220%",
        animation: "gradientShift 16s ease infinite",
      }}>
        {/* 网格光晕 */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 45%, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 45%, black 30%, transparent 75%)",
        }} />
        {/* 漂浮光斑 */}
        <div style={{
          position: "absolute", width: 320, height: 320, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.45), transparent 70%)",
          top: "8%", left: "10%", animation: "drift 14s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", width: 260, height: 260, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.4), transparent 70%)",
          bottom: "10%", right: "12%", animation: "drift 18s ease-in-out infinite reverse",
        }} />
        <div style={{
          position: "absolute", width: 200, height: 200, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16,185,129,0.3), transparent 70%)",
          top: "55%", left: "20%", animation: "drift 12s ease-in-out infinite 2s",
        }} />
        {/* 装饰图标 */}
        <SafetyOutlined style={{
          position: "absolute", fontSize: 260, color: "rgba(255,255,255,0.05)",
          right: "-40px", top: "-60px", transform: "rotate(15deg)",
        }} />

        <Card className="glass-card" style={{ width: 400, borderRadius: 20, boxShadow: "0 24px 70px rgba(0,0,0,0.45)", animation: "scaleIn 0.5s cubic-bezier(0.22,1,0.36,1) both" }}
          styles={{ body: { padding: "40px 36px" } }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{
              width: 72, height: 72, margin: "0 auto 16px", borderRadius: 20,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              boxShadow: "0 12px 32px rgba(59,130,246,0.5)",
              animation: "floaty 5s ease-in-out infinite",
            }}>
              <SafetyOutlined style={{ fontSize: 36, color: "#fff" }} />
            </div>
            <Title level={3} style={{ margin: 0, marginBottom: 4, background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              设备管理器
            </Title>
            <Text type="secondary" style={{ fontSize: 14 }}>内网设备账号管理平台</Text>
          </div>
          <Form name="login" form={form} onFinish={doLogin} size="large">
            <Form.Item name="username" rules={[{ required: true, message: "请输入用户名" }]}>
              <Input prefix={<UserOutlined />} placeholder="用户名" style={{ borderRadius: 10 }} />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: "请输入密码" }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="密码" style={{ borderRadius: 10 }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block
                className="gradient-btn" style={{ height: 46, borderRadius: 10, fontSize: 16, letterSpacing: 6 }}>
                登 录
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>

      <Modal title="首次登录 — 修改密码" open={changePwdOpen} closable={false} footer={null} width={400}>
        <div style={{ marginBottom: 16 }}>
          <Text>欢迎 <strong>{loginUser.display_name || loginUser.username}</strong>，首次登录请修改默认密码：</Text>
        </div>
        <Form onFinish={handleChangePassword} form={changePwdForm} layout="vertical">
          <Form.Item name="old_password" label="当前密码" rules={[{ required: true, message: "请输入当前密码" }]}>
            <Input.Password placeholder="admin123" />
          </Form.Item>
          <Form.Item name="new_password" label="新密码" rules={[
            { required: true, min: 6, message: "至少6位" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || value !== getFieldValue("old_password")) return Promise.resolve();
                return Promise.reject(new Error("新密码不能与旧密码相同"));
              },
            }),
          ]}>
            <Input.Password placeholder="输入新密码（至少6位）" />
          </Form.Item>
          <PasswordStrengthMeter password={newPwd || ""} />
          <Form.Item name="confirm" dependencies={["new_password"]} label="确认新密码" rules={[
            { required: true },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("new_password") === value) return Promise.resolve();
                return Promise.reject(new Error("两次密码不一致"));
              },
            }),
          ]}>
            <Input.Password placeholder="再次输入新密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block className="gradient-btn">确认修改</Button>
        </Form>
      </Modal>
    </>
  );
}
