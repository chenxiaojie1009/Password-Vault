import { useState, useEffect, useMemo } from 'react';
import {
  Table, Card, Button, Modal, Form, Input, Select, Space, Tag, Popconfirm, message, Grid, Avatar, Tooltip,
} from 'antd';
const { useBreakpoint } = Grid;
import {
  TeamOutlined, PlusOutlined, KeyOutlined, EditOutlined, DownloadOutlined,
  ImportOutlined, UserOutlined, StopOutlined, CheckCircleOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import api from '../api/client';
import { PageHeader, EmptyState } from '../components/ui';
import { ROLE_COLORS } from '../constants';

interface UserRecord {
  id: number;
  username: string;
  display_name: string;
  role: string;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
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
  const [roleOptions, setRoleOptions] = useState<Record<string, string>>({
    admin: '管理员', editor: '编辑者', viewer: '查看者', operator: '运维者',
  });
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setData(res.data || []);
    } catch {
      /* 保留已有数据 */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    api
      .get('/config/user_roles')
      .then((r) => {
        const map: Record<string, string> = { admin: '管理员', editor: '编辑者', viewer: '查看者', operator: '运维者' };
        (r.data || []).forEach((i: any) => {
          if (!map[i.value]) map[i.value] = i.value;
        });
        setRoleOptions(map);
      })
      .catch(() => {});
  }, []);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await api.post('/users', values);
      message.success('创建成功');
      setCreateOpen(false);
      form.resetFields();
      fetchUsers();
    } catch (err: any) {
      if (err.response) message.error(err.response.data?.detail || '创建失败');
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
      await api.put('/users/' + editUser!.id, payload);
      message.success('更新成功');
      setEditOpen(false);
      editForm.resetFields();
      setEditUser(null);
      fetchUsers();
    } catch (err: any) {
      if (err.response) message.error(err.response.data?.detail || '更新失败');
    }
  };

  const handleResetPassword = async () => {
    try {
      const values = await resetForm.validateFields();
      await api.put('/users/' + resetUser!.id + '/reset-password', { new_password: values.new_password });
      message.success('密码已重置，用户下次登录需修改密码');
      setResetOpen(false);
      resetForm.resetFields();
      setResetUser(null);
    } catch (err: any) {
      if (err.response) message.error(err.response.data?.detail || '重置失败');
    }
  };

  const handleToggleActive = async (user: UserRecord) => {
    try {
      await api.put('/users/' + user.id, { is_active: !user.is_active });
      message.success(user.is_active ? '已禁用' : '已启用');
      fetchUsers();
    } catch {
      message.error('操作失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete('/users/' + id);
      message.success('已删除');
      fetchUsers();
    } catch {
      message.error('删除失败');
    }
  };

  const handleExportAll = async () => {
    try {
      const res = await api.post('/export/all', {}, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = '全部数据_' + new Date().toISOString().slice(0, 10) + '.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      message.success('导出成功（含密码列表+用户列表）');
    } catch {
      message.error('导出失败');
    }
  };

  const handleImportUsers = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res = await api.post('/users/import', fd);
        message.success('导入完成：共 ' + res.data.total + ' 条，成功 ' + res.data.success);
        if (res.data.errors?.length) message.warning('部分失败：' + res.data.errors.slice(0, 3).join('; '));
        fetchUsers();
      } catch {
        message.error('导入失败');
      }
    };
    input.click();
  };

  const openEdit = (record: UserRecord) => {
    setEditUser(record);
    editForm.setFieldsValue({
      display_name: record.display_name,
      role: record.role,
      password: '',
      must_change_password: record.must_change_password,
    });
    setEditOpen(true);
  };

  const columns = useMemo(
    () => [
      {
        title: '用户',
        dataIndex: 'username',
        width: 200,
        render: (v: string, record: UserRecord) => (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <Avatar
              size={32}
              style={{
                background: record.is_active
                  ? 'linear-gradient(135deg,#3b82f6,#8b5cf6)'
                  : 'linear-gradient(135deg,#cbd5e1,#94a3b8)',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {(record.display_name || v || '?').slice(0, 1).toUpperCase()}
            </Avatar>
            <div>
              <div style={{ fontWeight: 600 }}>{record.display_name || v}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>@{v}</div>
            </div>
          </span>
        ),
      },
      {
        title: '角色',
        dataIndex: 'role',
        width: 110,
        render: (v: string) => <Tag color={ROLE_COLORS[v]}>{roleOptions[v] || v}</Tag>,
      },
      {
        title: '状态',
        dataIndex: 'is_active',
        width: 110,
        render: (v: boolean) => (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span className="status-dot" style={{ background: v ? 'var(--emerald)' : '#cbd5e1' }} />
            <span style={{ color: v ? '#059669' : 'var(--text-muted)', fontSize: 13 }}>{v ? '正常' : '已禁用'}</span>
          </span>
        ),
      },
      {
        title: '下次改密',
        dataIndex: 'must_change_password',
        width: 100,
        render: (v: boolean) =>
          v ? <Tag color="warning">需要</Tag> : <span style={{ color: 'var(--text-muted)' }}>-</span>,
      },
      {
        title: '操作',
        width: 280,
        align: 'right' as const,
        render: (_: any, record: UserRecord) => (
          <Space size={2}>
            <Tooltip title="编辑资料 / 角色">
              <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
            </Tooltip>
            <Tooltip title="重置密码">
              <Button
                type="text"
                size="small"
                icon={<KeyOutlined />}
                onClick={() => {
                  setResetUser(record);
                  setResetOpen(true);
                }}
              />
            </Tooltip>
            <Popconfirm title={record.is_active ? '确定禁用该用户？' : '确定启用该用户？'} onConfirm={() => handleToggleActive(record)}>
              <Tooltip title={record.is_active ? '禁用' : '启用'}>
                <Button
                  type="text"
                  size="small"
                  icon={record.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
                />
              </Tooltip>
            </Popconfirm>
            <Popconfirm title="确定删除该用户？" description="删除后不可恢复" onConfirm={() => handleDelete(record.id)}>
              <Tooltip title="删除">
                <Button type="text" size="small" danger icon={<StopOutlined />} />
              </Tooltip>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [roleOptions],
  );

  const userCard = (u: UserRecord, index: number) => (
    <Card
      key={u.id}
      className="glass-card hover-lift"
      style={{ marginBottom: 10, animation: `fadeInUp .4s ${Math.min(index, 8) * 0.05}s cubic-bezier(0.22,1,0.36,1) both` }}
      styles={{ body: { padding: 16 } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <Avatar
            size={38}
            style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', fontSize: 15, fontWeight: 600 }}
          >
            {(u.display_name || u.username || '?').slice(0, 1).toUpperCase()}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{u.display_name || u.username}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{u.username}</div>
            <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Tag color={ROLE_COLORS[u.role]}>{roleOptions[u.role] || u.role}</Tag>
              {u.is_active ? <Tag color="success">正常</Tag> : <Tag color="error">禁用</Tag>}
              {u.must_change_password && <Tag color="warning">需改密</Tag>}
            </div>
          </div>
        </div>
        <Space size={4} direction="vertical">
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(u)}>
            编辑
          </Button>
          <Button
            size="small"
            icon={<KeyOutlined />}
            onClick={() => {
              setResetUser(u);
              setResetOpen(true);
            }}
          >
            重置
          </Button>
        </Space>
      </div>
    </Card>
  );

  return (
    <div>
      <PageHeader
        icon={<TeamOutlined />}
        title="用户管理"
        subtitle={`共 ${data.length} 个账号 · 按角色分级授权`}
        extra={
          <>
            <Button icon={<DownloadOutlined />} onClick={handleExportAll}>
              导出全部
            </Button>
            <Button icon={<ImportOutlined />} onClick={handleImportUsers}>
              导入用户
            </Button>
            <Button type="primary" className="gradient-btn" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              添加用户
            </Button>
          </>
        }
      />

      <Card className="glass-card" styles={{ body: { padding: isMobile ? 14 : '4px 16px 16px' } }}>
        {isMobile ? (
          <div>
            {data.map((u, i) => userCard(u, i))}
            {!loading && data.length === 0 && (
              <EmptyState
                icon={<TeamOutlined />}
                title="暂无用户"
                description="添加用户后可按角色分配设备查看与编辑权限"
                actionText="添加用户"
                onAction={() => setCreateOpen(true)}
              />
            )}
          </div>
        ) : (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={data}
            loading={loading}
            pagination={{ pageSize: 15, showTotal: (t: number) => `共 ${t} 条` }}
            scroll={{ x: 860 }}
            locale={{
              emptyText: (
                <EmptyState
                  icon={<TeamOutlined />}
                  title="暂无用户"
                  description="添加用户后可按角色分配设备查看与编辑权限"
                  actionText="添加用户"
                  onAction={() => setCreateOpen(true)}
                />
              ),
            }}
          />
        )}
      </Card>

      {/* 添加用户 */}
      <Modal
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <PlusOutlined style={{ color: 'var(--primary)' }} /> 添加用户
          </span>
        }
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => {
          setCreateOpen(false);
          form.resetFields();
        }}
        destroyOnHidden
        okText="创建"
        width={440}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, min: 2, max: 64 }]}>
            <Input prefix={<UserOutlined />} placeholder="登录用户名" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, min: 6, max: 128 }]}>
            <Input.Password prefix={<KeyOutlined />} placeholder="至少6位" />
          </Form.Item>
          <Form.Item name="display_name" label="显示名称">
            <Input placeholder="可选，如：张伟" />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="viewer" rules={[{ required: true }]}>
            <Select options={Object.entries(roleOptions).map(([k, v]) => ({ label: v, value: k }))} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑用户 */}
      <Modal
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <EditOutlined style={{ color: 'var(--primary)' }} /> 编辑用户 — {editUser?.username}
          </span>
        }
        open={editOpen}
        onOk={handleEdit}
        onCancel={() => {
          setEditOpen(false);
          editForm.resetFields();
          setEditUser(null);
        }}
        destroyOnHidden
        okText="保存"
        width={440}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="display_name" label="显示名称">
            <Input placeholder="显示名称" />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="viewer" rules={[{ required: true }]}>
            <Select options={Object.entries(roleOptions).map(([k, v]) => ({ label: v, value: k }))} />
          </Form.Item>
          <Form.Item name="password" label="新密码（留空不修改）" rules={[{ min: 6, message: '至少6位' }]}>
            <Input.Password prefix={<KeyOutlined />} placeholder="留空则不修改密码" />
          </Form.Item>
          <Form.Item
            name="confirm"
            dependencies={['password']}
            label="确认新密码"
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!getFieldValue('password') || getFieldValue('password') === value) return Promise.resolve();
                  return Promise.reject(new Error('两次密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<KeyOutlined />} placeholder="再次输入新密码" />
          </Form.Item>
          <Form.Item
            name="must_change_password"
            label="强制下次登录修改密码"
            initialValue={false}
          >
            <Select options={[{ label: '是', value: true }, { label: '否', value: false }]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 重置密码 */}
      <Modal
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <SafetyCertificateOutlined style={{ color: 'var(--primary)' }} /> 重置密码 — {resetUser?.username}
          </span>
        }
        open={resetOpen}
        onOk={handleResetPassword}
        onCancel={() => {
          setResetOpen(false);
          resetForm.resetFields();
          setResetUser(null);
        }}
        destroyOnHidden
        okText="重置"
        width={420}
      >
        <Form form={resetForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="new_password" label="新密码" rules={[{ required: true, min: 6, message: '至少6位' }]}>
            <Input.Password prefix={<KeyOutlined />} placeholder="输入新密码" />
          </Form.Item>
          <Form.Item
            name="confirm"
            dependencies={['new_password']}
            label="确认新密码"
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
            <Input.Password prefix={<KeyOutlined />} placeholder="再次输入" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
