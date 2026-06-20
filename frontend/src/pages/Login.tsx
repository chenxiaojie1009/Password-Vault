import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Form, Input, Button, Typography, message, Modal } from "antd";
import { UserOutlined, LockOutlined, SafetyOutlined } from "@ant-design/icons";
import api from "../api/client";

const { Title, Text } = Typography;

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [changePwdOpen, setChangePwdOpen] = useState(false);
  const [loginUser, setLoginUser] = useState({ username: "", display_name: "" });
  const [form] = Form.useForm();
  const navigate = useNavigate();

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
        background: "linear-gradient(135deg, #0f2027 0%, #203a43 40%, #2c5364 100%)",
      }}>
        <Card style={{ width: 400, borderRadius: 12, boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}
          styles={{ body: { padding: "36px 32px" } }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <SafetyOutlined style={{ fontSize: 48, color: "#1677ff" }} />
            <Title level={3} style={{ marginTop: 12, marginBottom: 4 }}>设备管理器</Title>
            <Text type="secondary">内网设备账号管理平台</Text>
          </div>
          <Form name="login" form={form} onFinish={doLogin} size="large">
            <Form.Item name="username" rules={[{ required: true, message: "请输入用户名" }]}>
              <Input prefix={<UserOutlined />} placeholder="用户名" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: "请输入密码" }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="密码" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>登 录</Button>
            </Form.Item>
          </Form>
        </Card>
      </div>

      <Modal title="首次登录 — 修改密码" open={changePwdOpen} closable={false} footer={null} width={400}>
        <div style={{ marginBottom: 16 }}>
          <Text>欢迎 <strong>{loginUser.display_name || loginUser.username}</strong>，首次登录请修改默认密码：</Text>
        </div>
        <Form onFinish={handleChangePassword} layout="vertical">
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
          <Button type="primary" htmlType="submit" block>确认修改</Button>
        </Form>
      </Modal>
    </>
  );
}
