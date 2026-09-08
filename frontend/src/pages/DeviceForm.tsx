import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Form, Input, Select, Button, Space, message, Popconfirm, Typography, Switch, Upload, Tag, Tooltip, Card, Grid,
} from 'antd';
const { Dragger } = Upload;
const { useBreakpoint } = Grid;
import {
  ArrowLeftOutlined, PlusOutlined, DeleteOutlined, InboxOutlined, DownloadOutlined,
  EditOutlined, ThunderboltOutlined, CloudServerOutlined, GlobalOutlined, HddOutlined,
  UserOutlined, PaperClipOutlined, FileTextOutlined, SaveOutlined, CloseOutlined,
} from '@ant-design/icons';
import api from '../api/client';
import { generatePassword, formatSize } from '../utils';
import { PageHeader, SectionCard } from '../components/ui';

const { Text } = Typography;

const DEFAULT_TYPES = ['服务器', '交换机', '纵加设备', '路由器', '防火墙', '存储设备', '工作站', '其他'];
const ALL_LEVELS = ['一级设备', '二级设备', '三级设备', '四级设备'];
const ROLE_MAX_LEVEL: Record<string, number> = { admin: 4, operator: 3, editor: 2, viewer: 1 };
const ALLOWED_FILE_EXTS = [
  '.doc', '.docx', '.xls', '.xlsx', '.pdf',
  '.ppt', '.pptx', '.txt', '.csv',
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tif', '.tiff',
  '.zip', '.rar', '.7z', '.tar', '.gz', '.tgz', '.bz2', '.xz',
];

function allowedLevels(role: string): string[] {
  const max = ROLE_MAX_LEVEL[role] || 1;
  return ALL_LEVELS.filter((_, i) => i + 1 <= max);
}

/** 表单内可复用的行容器 */
const RowBox = ({ children, index }: { children: React.ReactNode; index: number }) => (
  <div
    style={{
      padding: '14px 16px 2px',
      marginBottom: 10,
      borderRadius: 14,
      background: 'rgba(100,116,139,0.045)',
      border: '1px solid var(--line)',
      transition: 'border-color .26s, background .26s, box-shadow .26s',
      animation: `fadeInUp .35s ${Math.min(index, 6) * 0.04}s cubic-bezier(0.22,1,0.36,1) both`,
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)';
      e.currentTarget.style.boxShadow = '0 6px 18px rgba(15,23,42,0.06)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = 'var(--line)';
      e.currentTarget.style.boxShadow = 'none';
    }}
  >
    {children}
  </div>
);

export default function DeviceForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deviceTypes, setDeviceTypes] = useState<string[]>(DEFAULT_TYPES);
  const isEdit = !!id;
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<any[]>([]);
  const user = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}'), []);
  const levelOptions = allowedLevels(user.role || 'viewer');
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  useEffect(() => {
    api
      .get('/config/device_types')
      .then((r) => {
        const vals = r.data?.map((i: any) => i.value) || [];
        setDeviceTypes([...new Set([...DEFAULT_TYPES, ...vals])]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (id) {
      setLoading(true);
      api
        .get('/devices/' + id)
        .then((res) => {
          const d = res.data;
          form.setFieldsValue({
            name: d.name,
            device_type: d.device_type,
            location: d.location,
            notes: d.notes,
            is_network_involved: d.is_network_involved,
            device_level: d.device_level,
            ips: (d.ips || []).map((ip: any) => ({ address: ip.address, label: ip.label, _id: ip.id })),
            macs: (d.macs || []).map((m: any) => ({ address: m.address, label: m.label, _id: m.id })),
            accounts: (d.accounts || []).map((a: any) => ({
              username: a.username, password: '', notes: a.notes, _id: a.id,
            })),
          });
        })
        .catch(() => message.error('加载设备失败'))
        .finally(() => setLoading(false));
      api
        .get('/devices/' + id + '/files')
        .then((res) => setExistingFiles(res.data || []))
        .catch(() => {});
    }
  }, [id, form]);

  const onFinish = async (values: any) => {
    setSaving(true);
    try {
      const payload = {
        name: values.name,
        device_type: values.device_type,
        location: values.location,
        notes: values.notes,
        is_network_involved: values.is_network_involved || false,
        device_level: values.device_level || '一级设备',
        ips: (values.ips || []).map((x: any) => ({ address: x.address, label: x.label || '' })),
        macs: (values.macs || []).map((x: any) => ({ address: x.address, label: x.label || '' })),
        accounts: (values.accounts || []).map((a: any) => ({
          username: a.username, password: a.password, notes: a.notes,
        })),
      };

      if (isEdit) {
        await api.put('/devices/' + id, payload);
        for (const acc of values.accounts || []) {
          if (acc.password && acc.password.trim()) {
            if (acc._id) {
              await api.put('/accounts/' + acc._id, {
                username: acc.username, password: acc.password, notes: acc.notes || '',
              });
            } else {
              await api.post('/devices/' + id + '/accounts', {
                username: acc.username, password: acc.password, notes: acc.notes || '',
              });
            }
          }
        }
        message.success('设备已更新');
        if (pendingFiles.length > 0) {
          const fd = new FormData();
          pendingFiles.forEach((f) => fd.append('files', f));
          try {
            const upRes = await api.post('/devices/' + id + '/files', fd);
            if (upRes.data.errors?.length) {
              message.warning('部分文件上传失败: ' + upRes.data.errors.slice(0, 3).join('; '));
            }
          } catch {
            message.warning('文件上传失败');
          }
        }
      } else {
        const res = await api.post('/devices', payload);
        const newId = res.data.id;
        message.success('设备已创建');
        if (pendingFiles.length > 0) {
          const fd = new FormData();
          pendingFiles.forEach((f) => fd.append('file', f));
          try {
            const upRes = await api.post('/devices/' + newId + '/files', fd);
            if (upRes.data.errors?.length) {
              message.warning('部分文件上传失败: ' + upRes.data.errors.slice(0, 3).join('; '));
            }
          } catch {
            message.warning('文件上传失败');
          }
        }
      }
      navigate('/devices');
    } catch (err: any) {
      message.error(err.response?.data?.detail || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async (accountId: number) => {
    try {
      await api.delete('/accounts/' + accountId);
      message.success('账号已删除');
      const res = await api.get('/devices/' + id);
      form.setFieldsValue({
        accounts: (res.data.accounts || []).map((a: any) => ({
          username: a.username, password: '', notes: a.notes, _id: a.id,
        })),
      });
    } catch {
      message.error('删除失败');
    }
  };

  const deleteFile = async (fileId: number) => {
    try {
      await api.delete('/files/' + fileId);
      message.success('文件已删除');
      setExistingFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch {
      message.error('删除文件失败');
    }
  };

  const accounts = Form.useWatch('accounts', form) || [];

  return (
    <div>
      <PageHeader
        icon={isEdit ? <EditOutlined /> : <PlusOutlined />}
        title={isEdit ? '编辑设备' : '添加设备'}
        subtitle={isEdit ? '修改设备信息、账号密码与附件' : '录入设备信息、IP / MAC、账号密码与附件'}
        leading={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/devices')}>
            返回
          </Button>
        }
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{
          device_type: '其他',
          ips: [{ address: '', label: '' }],
          macs: [{ address: '', label: '' }],
          accounts: [{ username: '', password: '', notes: '' }],
        }}
      >
        <SectionCard
          icon={<CloudServerOutlined />}
          title="基本信息"
          loading={loading}
          style={{ marginBottom: 16 }}
          bodyStyle={{ paddingTop: 16 }}
        >
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Form.Item name="name" label="设备名称" rules={[{ required: true, message: '请输入设备名称' }]} style={{ minWidth: 260, flex: 1, marginBottom: 12 }}>
              <Input placeholder="如：核心交换机-A01" />
            </Form.Item>
            <Form.Item name="device_type" label="设备类型" rules={[{ required: true }]} style={{ width: 200, marginBottom: 12 }}>
              <Select
                options={deviceTypes.map((t) => ({ label: t, value: t }))}
                showSearch
                onSearch={(val) => {
                  if (val && !deviceTypes.includes(val)) {
                    setDeviceTypes((prev) => [...prev, val]);
                    api.post('/config/device_types', { value: val }).catch(() => {});
                  }
                }}
                placeholder="选择或输入新类型"
              />
            </Form.Item>
            <Form.Item name="device_level" label="设备分级" initialValue="一级设备" rules={[{ required: true }]} style={{ width: 160, marginBottom: 12 }}>
              <Select options={levelOptions.map((t) => ({ label: t, value: t }))} />
            </Form.Item>
            <Form.Item name="is_network_involved" label="涉网设备" valuePropName="checked" style={{ marginBottom: 12 }}>
              <Switch checkedChildren="是" unCheckedChildren="否" />
            </Form.Item>
          </div>
          <Form.Item name="location" label="位置" style={{ marginBottom: 0 }}>
            <Input placeholder="如：机房A-01机柜" style={{ maxWidth: 320 }} />
          </Form.Item>
        </SectionCard>

        <SectionCard
          icon={<GlobalOutlined />}
          title="IP 地址"
          style={{ marginBottom: 16 }}
          bodyStyle={{ paddingTop: 16 }}
        >
          <Form.List name="ips">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }, idx) => (
                  <RowBox key={key} index={idx}>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                      <Form.Item {...rest} name={[name, '_id']} hidden>
                        <Input />
                      </Form.Item>
                      <Form.Item {...rest} name={[name, 'address']} label="IP 地址" rules={[{ required: true, message: '必填' }]} style={{ width: 200, marginBottom: 12 }}>
                        <Input placeholder="192.168.1.1" />
                      </Form.Item>
                      <Form.Item {...rest} name={[name, 'label']} label="标签" style={{ width: 180, marginBottom: 12 }}>
                        <Input placeholder="如：管理口" />
                      </Form.Item>
                      <Form.Item label=" ">
                        <Button danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
                      </Form.Item>
                    </div>
                  </RowBox>
                ))}
                <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ address: '', label: '' })}>
                  添加 IP 地址
                </Button>
              </>
            )}
          </Form.List>
        </SectionCard>

        <SectionCard
          icon={<HddOutlined />}
          title="MAC 地址"
          style={{ marginBottom: 16 }}
          bodyStyle={{ paddingTop: 16 }}
        >
          <Form.List name="macs">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }, idx) => (
                  <RowBox key={key} index={idx}>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                      <Form.Item {...rest} name={[name, '_id']} hidden>
                        <Input />
                      </Form.Item>
                      <Form.Item {...rest} name={[name, 'address']} label="MAC 地址" rules={[{ required: true, message: '必填' }]} style={{ width: 220, marginBottom: 12 }}>
                        <Input placeholder="AA:BB:CC:DD:EE:FF" />
                      </Form.Item>
                      <Form.Item {...rest} name={[name, 'label']} label="标签" style={{ width: 180, marginBottom: 12 }}>
                        <Input placeholder="如：主网卡" />
                      </Form.Item>
                      <Form.Item label=" ">
                        <Button danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
                      </Form.Item>
                    </div>
                  </RowBox>
                ))}
                <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ address: '', label: '' })}>
                  添加 MAC 地址
                </Button>
              </>
            )}
          </Form.List>
        </SectionCard>

        <SectionCard
          icon={<UserOutlined />}
          title="账号密码"
          extra={<Text type="secondary" style={{ fontSize: 12 }}>密码将以 Fernet 加密存储</Text>}
          style={{ marginBottom: 16 }}
          bodyStyle={{ paddingTop: 16 }}
        >
          <Form.List name="accounts">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }, idx) => (
                  <RowBox key={key} index={idx}>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                      <Form.Item {...rest} name={[name, '_id']} hidden>
                        <Input />
                      </Form.Item>
                      <Form.Item {...rest} name={[name, 'username']} label="用户名" rules={[{ required: true, message: '必填' }]} style={{ width: 150, marginBottom: 12 }}>
                        <Input placeholder="root" />
                      </Form.Item>
                      <Form.Item {...rest} name={[name, 'password']} label="密码" rules={[{ required: !isEdit, message: '必填' }]} style={{ width: 200, marginBottom: 12 }}>
                        <Input.Password placeholder={isEdit ? '留空则不修改' : '输入密码'} />
                      </Form.Item>
                      <Form.Item label=" ">
                        <Tooltip title="生成强密码">
                          <Button
                            icon={<ThunderboltOutlined />}
                            onClick={() => form.setFieldValue(['accounts', name, 'password'], generatePassword())}
                          />
                        </Tooltip>
                      </Form.Item>
                      <Form.Item {...rest} name={[name, 'notes']} label="备注" style={{ width: 180, marginBottom: 12 }}>
                        <Input placeholder="可选" />
                      </Form.Item>
                      <Form.Item label=" ">
                        {isEdit && form.getFieldValue(['accounts', name, '_id']) ? (
                          <Popconfirm
                            title="删除此账号?"
                            description="保存后生效"
                            onConfirm={() => deleteAccount(form.getFieldValue(['accounts', name, '_id']))}
                          >
                            <Button danger icon={<DeleteOutlined />} />
                          </Popconfirm>
                        ) : (
                          <Button danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
                        )}
                      </Form.Item>
                    </div>
                  </RowBox>
                ))}
                <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ username: '', password: '', notes: '' })}>
                  添加账号
                </Button>
              </>
            )}
          </Form.List>
        </SectionCard>

        <SectionCard
          icon={<PaperClipOutlined />}
          title="附件"
          extra={<Text type="secondary" style={{ fontSize: 12 }}>单文件 ≤ 100MB</Text>}
          style={{ marginBottom: 16 }}
          bodyStyle={{ paddingTop: 16 }}
        >
          {isEdit && existingFiles.length > 0 && (
            <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {existingFiles.map((f: any) => (
                <div
                  key={f.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: 'rgba(100,116,139,0.05)',
                    border: '1px solid var(--line)',
                  }}
                >
                  <Space>
                    <span
                      className="icon-badge"
                      style={{
                        width: 30, height: 30, borderRadius: 9, fontSize: 14,
                        background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', boxShadow: 'none',
                      }}
                    >
                      <FileTextOutlined />
                    </span>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{f.original_filename}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {f.file_type?.toUpperCase()} · {formatSize(f.file_size)}
                      </div>
                    </div>
                  </Space>
                  <Space size={2}>
                    <Button
                      size="small"
                      type="text"
                      icon={<DownloadOutlined />}
                      onClick={async () => {
                        try {
                          const res = await api.get('/files/' + f.id + '/download', { responseType: 'blob' });
                          const url = URL.createObjectURL(new Blob([res.data]));
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = f.original_filename;
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch {
                          message.error('下载失败');
                        }
                      }}
                    />
                    <Popconfirm title="确定删除此文件？" onConfirm={() => deleteFile(f.id)}>
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                </div>
              ))}
            </div>
          )}

          {pendingFiles.length > 0 && (
            <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pendingFiles.map((f, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: 'rgba(59,130,246,0.06)',
                    border: '1px dashed rgba(59,130,246,0.4)',
                  }}
                >
                  <Space>
                    <Tag color="processing" style={{ marginInlineEnd: 0 }}>
                      待上传
                    </Tag>
                    <span style={{ fontSize: 13 }}>{f.name}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatSize(f.size)}</span>
                  </Space>
                  <Button
                    size="small"
                    danger
                    type="text"
                    icon={<DeleteOutlined />}
                    onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                  />
                </div>
              ))}
            </div>
          )}

          <Dragger
            multiple
            accept={ALLOWED_FILE_EXTS.join(',')}
            showUploadList={false}
            beforeUpload={(file) => {
              const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
              if (!ALLOWED_FILE_EXTS.includes(ext)) {
                message.error(`不支持的文件类型: ${ext}`);
                return false;
              }
              if (file.size > 100 * 1024 * 1024) {
                message.error(`文件 ${file.name} 超过 100MB`);
                return false;
              }
              setPendingFiles((prev) => [...prev, file]);
              return false;
            }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ color: 'var(--primary)' }} />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此处上传</p>
            <p className="ant-upload-hint">
              支持压缩包（zip/rar/7z）、Word、Excel、PPT、PDF、图片、文本等，单文件不超过 100MB
            </p>
          </Dragger>
        </SectionCard>

        <SectionCard
          icon={<FileTextOutlined />}
          title="备注"
          style={{ marginBottom: 16 }}
          bodyStyle={{ paddingTop: 16 }}
        >
          <Form.Item name="notes" style={{ marginBottom: 0 }}>
            <Input.TextArea rows={3} placeholder="补充说明，如巡检周期、负责人等" />
          </Form.Item>
        </SectionCard>

        {/* 吸底操作栏 */}
        <Card
          className="glass-strong"
          style={{
            position: 'sticky',
            bottom: 12,
            zIndex: 5,
            borderRadius: 16,
            boxShadow: 'var(--shadow-lg)',
            animation: 'fadeInUp .45s .1s cubic-bezier(0.22,1,0.36,1) both',
          }}
          styles={{ body: { padding: '12px 18px' } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <Text type="secondary" style={{ fontSize: 12.5 }}>
              共 {accounts.length} 个账号 · {existingFiles.length + pendingFiles.length} 个附件
              {isMobile ? '' : ' · 带 * 为必填项'}
            </Text>
            <Space>
              <Button icon={<CloseOutlined />} onClick={() => navigate('/devices')}>
                取消
              </Button>
              <Button
                type="primary"
                className="gradient-btn"
                htmlType="submit"
                loading={saving}
                icon={<SaveOutlined />}
              >
                {isEdit ? '保存修改' : '创建设备'}
              </Button>
            </Space>
          </div>
        </Card>
      </Form>
    </div>
  );
}
