import { useState, useEffect } from "react";
import { Table, Card, Button, Modal, Form, Input, Select, Space, Tag, Popconfirm, message, Typography } from "antd";
import { TeamOutlined, PlusOutlined, KeyOutlined, EditOutlined, DownloadOutlined, ImportOutlined } from "@ant-design/icons";
import api from "../api/client";

const { Title } = Typography;
const roleColors: Record<string, string> = { admin: "red", editor: "blue", viewer: "green", operator: "orange" };

interface UserRecord {
  id: number; username: string; display_name: string; role: string;
  is_active: boolean; must_change_password: boolean; created_at: string;
}

export default function UserManagement() {
  const [data, setData] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUser, setResetUser] = useState<UserRecord | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [resetForm] = Form.useForm();
  const [roleOptions, setRoleOptions] = useState<Record<string, string>>({"admin":"管理员","editor":"编辑者","viewer":"查看者","operator":"运维者"});

  const fetchUsers = async () => {
    setLoading(true);
    try { const res = await api.get("/users"); setData(res.data || []); }
    catch { /* keep existing data on error */ } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchUsers();
    api.get("/config/user_roles").then(r => {
      const map: Record<string, string> = {"admin":"管理员","editor":"编辑者","viewer":"查看者","operator":"运维者"};
      (r.data || []).forEach((i: any) => { if (!map[i.value]) map[i.value] = i.value; });
      setRoleOptions(map);
    }).catch(() => {});
  }, []);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await api.post("/users", values);
      message.success("创建成功");
      setCreateOpen(false); form.resetFields(); fetchUsers();
    } catch (err: any) {
      if (err.response) message.error(err.response.data?.detail || "创建失败");
    }
  };

  const handleEdit = async () => {
    try {
      const values = await editForm.validateFields();
      const payload: Record<string, any> = {};
      if (values.display_name !== undefined && values.display_name !== editUser!.display_name)
        payload.display_name = values.display_name;
      if (values.role !== editUser!.role) payload.role = values.role;
      if (values.password) payload.password = values.password;
      if (values.must_change_password !== undefined) payload.must_change_password = values.must_change_password;
      await api.put("/users/" + editUser!.id, payload);
      message.success("更新成功");
      setEditOpen(false); editForm.resetFields(); setEditUser(null); fetchUsers();
    } catch (err: any) {
      if (err.response) message.error(err.response.data?.detail || "更新失败");
    }
  };

  const handleResetPassword = async () => {
    try {
      const values = await resetForm.validateFields();
      await api.put("/users/" + resetUser!.id + "/reset-password", { new_password: values.new_password });
      message.success("密码已重置，用户下次登录需修改密码");
      setResetOpen(false); resetForm.resetFields(); setResetUser(null);
    } catch (err: any) {
      if (err.response) message.error(err.response.data?.detail || "重置失败");
    }
  };

  const handleToggleActive = async (user: UserRecord) => {
    try {
      await api.put("/users/" + user.id, { is_active: !user.is_active });
      message.success(user.is_active ? "已禁用" : "已启用"); fetchUsers();
    } catch { message.error("操作失败"); }
  };

  const handleDelete = async (id: number) => {
    try { await api.delete("/users/" + id); message.success("已删除"); fetchUsers(); }
    catch { message.error("删除失败"); }
  };

  const handleExportAll = async () => {
    try {
      const res = await api.post("/export/all", {}, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a"); a.href = url;
      a.download = "全部数据_" + new Date().toISOString().slice(0, 10) + ".xlsx";
      a.click(); URL.revokeObjectURL(url);
      message.success("导出成功（含密码列表+用户列表）");
    } catch { message.error("导出失败"); }
  };

  const handleImportUsers = () => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".xlsx,.xls";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]; if (!file) return;
      const fd = new FormData(); fd.append("file", file);
      try {
        const res = await api.post("/users/import", fd);
        message.success("导入完成：共 " + res.data.total + " 条，成功 " + res.data.success);
        if (res.data.errors?.length) message.warning("部分失败：" + res.data.errors.slice(0, 3).join("; "));
        fetchUsers();
      } catch { message.error("导入失败"); }
    };
    input.click();
  };

  const columns = [
    { title: "用户名", dataIndex: "username", width: 120 },
    { title: "显示名", dataIndex: "display_name", width: 120 },
    { title: "角色", dataIndex: "role", width: 80, render: (v: string) => <Tag color={roleColors[v]}>{roleOptions[v] || v}</Tag> },
    { title: "状态", dataIndex: "is_active", width: 70, render: (v: boolean) => v ? <Tag color="success">正常</Tag> : <Tag color="error">禁用</Tag> },
    { title: "下次改密", dataIndex: "must_change_password", width: 80, render: (v: boolean) => v ? <Tag color="warning">需要</Tag> : <Tag>-</Tag> },
    { title: "操作", width: 300,
      render: (_: any, record: UserRecord) => (
        <Space>
          <Button size="small" type="link" icon={<EditOutlined />}
            onClick={() => {
              setEditUser(record);
              editForm.setFieldsValue({
                display_name: record.display_name,
                role: record.role,
                password: "",
                must_change_password: record.must_change_password,
              });
              setEditOpen(true);
            }}>编辑</Button>
          <Button size="small" type="link" icon={<KeyOutlined />}
            onClick={() => { setResetUser(record); setResetOpen(true); }}>重置密码</Button>
          <Popconfirm title="确定切换状态？" onConfirm={() => handleToggleActive(record)}>
            <Button size="small" type="link">{record.is_active ? "禁用" : "启用"}</Button>
          </Popconfirm>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" type="link" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}><TeamOutlined style={{ marginRight: 8 }} />用户管理</Title>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={handleExportAll}>导出全部</Button>
          <Button icon={<ImportOutlined />} onClick={handleImportUsers}>导入用户</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>添加用户</Button>
        </Space>
      </div>
      <Card>
        <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={{ pageSize: 15 }} locale={{ emptyText: "暂无用户" }} />
      </Card>

      {/* 添加用户 */}
      <Modal title="添加用户" open={createOpen} onOk={handleCreate}
        onCancel={() => { setCreateOpen(false); form.resetFields(); }} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, min: 2, max: 64 }]}>
            <Input placeholder="登录用户名" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, min: 6, max: 128 }]}>
            <Input.Password placeholder="至少6位" />
          </Form.Item>
          <Form.Item name="display_name" label="显示名称"><Input placeholder="可选" /></Form.Item>
          <Form.Item name="role" label="角色" initialValue="viewer" rules={[{ required: true }]}>
            <Select options={Object.entries(roleOptions).map(([k, v]) => ({ label: v, value: k }))} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑用户 */}
      <Modal title={"编辑用户 — " + (editUser?.username || "")} open={editOpen} onOk={handleEdit}
        onCancel={() => { setEditOpen(false); editForm.resetFields(); setEditUser(null); }} destroyOnClose>
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="display_name" label="显示名称">
            <Input placeholder="显示名称" />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="viewer" rules={[{ required: true }]}>
            <Select options={Object.entries(roleOptions).map(([k, v]) => ({ label: v, value: k }))} />
          </Form.Item>
          <Form.Item name="password" label="新密码（留空不修改）" rules={[{ min: 6, message: "至少6位" }]}>
            <Input.Password placeholder="留空则不修改密码" />
          </Form.Item>
          <Form.Item name="confirm" dependencies={["password"]} label="确认新密码"
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!getFieldValue("password") || getFieldValue("password") === value) return Promise.resolve();
                  return Promise.reject(new Error("两次密码不一致"));
                },
              }),
            ]}>
            <Input.Password placeholder="再次输入新密码" />
          </Form.Item>
          <Form.Item name="must_change_password" label="强制下次登录修改密码" valuePropName="checked" initialValue={false}>
            <Select options={[{ label: "是", value: true }, { label: "否", value: false }]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 重置密码 */}
      <Modal title={"重置密码 — " + (resetUser?.username || "")} open={resetOpen} onOk={handleResetPassword}
        onCancel={() => { setResetOpen(false); resetForm.resetFields(); setResetUser(null); }} destroyOnClose>
        <Form form={resetForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="new_password" label="新密码" rules={[{ required: true, min: 6, message: "至少6位" }]}>
            <Input.Password placeholder="输入新密码" />
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
            <Input.Password placeholder="再次输入" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
