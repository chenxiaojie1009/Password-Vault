import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, Form, Input, Select, Button, Space, Divider, message, Popconfirm, Typography, Switch, Upload, Tag, Tooltip } from "antd";
const { Dragger } = Upload;
import { ArrowLeftOutlined, PlusOutlined, DeleteOutlined, InboxOutlined, DownloadOutlined, EditOutlined, ThunderboltOutlined } from "@ant-design/icons";
import api from "../api/client";
import { generatePassword } from "../utils";

const { Title } = Typography;
const DEFAULT_TYPES = ["服务器", "交换机", "纵加设备", "路由器", "防火墙", "存储设备", "工作站", "其他"];
const ALL_LEVELS = ["一级设备", "二级设备", "三级设备", "四级设备"];
const ROLE_MAX_LEVEL: Record<string, number> = { admin: 4, operator: 3, editor: 2, viewer: 1 };

// Levels this role is allowed to create/edit (e.g. viewer → only 一级设备)
function allowedLevels(role: string): string[] {
  const max = ROLE_MAX_LEVEL[role] || 1;
  return ALL_LEVELS.filter((_, i) => i + 1 <= max);
}

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
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const levelOptions = allowedLevels(user.role || "viewer");

  useEffect(() => {
    api.get("/config/device_types").then(r => {
      const vals = r.data?.map((i: any) => i.value) || [];
      setDeviceTypes([...new Set([...DEFAULT_TYPES, ...vals])]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (id) {
      setLoading(true);
      api.get("/devices/" + id)
        .then((res) => {
          const d = res.data;
          form.setFieldsValue({
            name: d.name, device_type: d.device_type,
            location: d.location, notes: d.notes,
            is_network_involved: d.is_network_involved, device_level: d.device_level,
            ips: (d.ips || []).map((ip: any) => ({ address: ip.address, label: ip.label, _id: ip.id })),
            macs: (d.macs || []).map((m: any) => ({ address: m.address, label: m.label, _id: m.id })),
            accounts: (d.accounts || []).map((a: any) => ({
              username: a.username, password: "", notes: a.notes, _id: a.id,
            })),
          });
        })
        .catch(() => message.error("加载设备失败"))
        .finally(() => setLoading(false));
      // Fetch existing files
      api.get("/devices/" + id + "/files")
        .then((res) => setExistingFiles(res.data || []))
        .catch(() => {});
    }
  }, [id, form]);

  const onFinish = async (values: any) => {
    setSaving(true);
    try {
      const payload = {
        name: values.name, device_type: values.device_type,
        location: values.location, notes: values.notes,
        is_network_involved: values.is_network_involved || false, device_level: values.device_level || "一级设备",
        ips: (values.ips || []).map((x: any) => ({ address: x.address, label: x.label || "" })),
        macs: (values.macs || []).map((x: any) => ({ address: x.address, label: x.label || "" })),
        accounts: (values.accounts || []).map((a: any) => ({
          username: a.username, password: a.password, notes: a.notes,
        })),
      };

      if (isEdit) {
        await api.put("/devices/" + id, payload);
        for (const acc of values.accounts || []) {
          if (acc.password && acc.password.trim()) {
            if (acc._id) {
              await api.put("/accounts/" + acc._id, {
                username: acc.username, password: acc.password, notes: acc.notes || "",
              });
            } else {
              await api.post("/devices/" + id + "/accounts", {
                username: acc.username, password: acc.password, notes: acc.notes || "",
              });
            }
          }
        }
        message.success("设备已更新");
        // Upload pending files for existing device
        if (pendingFiles.length > 0) {
          const fd = new FormData();
          pendingFiles.forEach((f) => fd.append("files", f));
          try {
            const upRes = await api.post("/devices/" + id + "/files", fd);
            if (upRes.data.errors?.length) {
              message.warning("部分文件上传失败: " + upRes.data.errors.slice(0, 3).join("; "));
            }
          } catch { message.warning("文件上传失败"); }
        }
      } else {
        const res = await api.post("/devices", payload);
        const newId = res.data.id;
        message.success("设备已创建");
        // Upload pending files to new device
        if (pendingFiles.length > 0) {
          const fd = new FormData();
          pendingFiles.forEach((f) => fd.append("files", f));
          try {
            const upRes = await api.post("/devices/" + newId + "/files", fd);
            if (upRes.data.errors?.length) {
              message.warning("部分文件上传失败: " + upRes.data.errors.slice(0, 3).join("; "));
            }
          } catch { message.warning("文件上传失败"); }
        }
      }
      navigate("/devices");
    } catch (err: any) {
      message.error(err.response?.data?.detail || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async (accountId: number) => {
    try {
      await api.delete("/accounts/" + accountId);
      message.success("账号已删除");
      const res = await api.get("/devices/" + id);
      form.setFieldsValue({
        accounts: (res.data.accounts || []).map((a: any) => ({
          username: a.username, password: "", notes: a.notes, _id: a.id,
        })),
      });
    } catch { message.error("删除失败"); }
  };

  const deleteFile = async (fileId: number) => {
    try {
      await api.delete("/files/" + fileId);
      message.success("文件已删除");
      setExistingFiles(prev => prev.filter(f => f.id !== fileId));
    } catch { message.error("删除文件失败"); }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  return (
    <div style={{ maxWidth: "100%", width: "100%", padding: "0 8px", margin: "0 auto" }} className="page-transition">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/devices")}>返回</Button>
        <div style={{ fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 34, height: 34, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", color: "#fff", boxShadow: "0 4px 12px rgba(59,130,246,0.4)",
          }}>{isEdit ? <EditOutlined /> : <PlusOutlined />}</span>
          {isEdit ? "编辑设备" : "添加设备"}
        </div>
      </div>
      <Card loading={loading} className="glass-card">
        <Form form={form} layout="vertical" onFinish={onFinish}
          initialValues={{ device_type: "其他", ips: [{ address: "", label: "" }], macs: [{ address: "", label: "" }], accounts: [{ username: "", password: "", notes: "" }] }}>
          <Title level={5}>基本信息</Title>
          <Space style={{ width: "100%" }} size={16}>
            <Form.Item name="name" label="设备名称" rules={[{ required: true }]} style={{ width: 260 }}>
              <Input placeholder="如：核心交换机-A01" />
            </Form.Item>
            <Form.Item name="device_type" label="设备类型" rules={[{ required: true }]} style={{ width: 170 }}>
              <Select
                options={deviceTypes.map((t) => ({ label: t, value: t }))}
                showSearch
                onSearch={(val) => {
                  if (val && !deviceTypes.includes(val)) {
                    setDeviceTypes(prev => [...prev, val]);
                    api.post("/config/device_types", { value: val }).catch(() => {});
                  }
                }}
                placeholder="选择或输入新类型"
              />
            </Form.Item>
          </Space>
          <Form.Item name="location" label="位置">
            <Input placeholder="如：机房A" style={{ width: 300 }} />
          </Form.Item>
          <Form.Item name="is_network_involved" label="涉网设备" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
          <Form.Item name="device_level" label="设备分级" initialValue="一级设备" rules={[{ required: true }]}>
            <Select options={levelOptions.map(t => ({ label: t, value: t }))} style={{ width: 140 }} />
          </Form.Item>

          <Title level={5}>IP 地址</Title>
          <Form.List name="ips">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }) => (
                  <Space key={key} align="baseline" style={{ marginBottom: 6 }}>
                    <Form.Item {...rest} name={[name, "_id"]} hidden><Input /></Form.Item>
                    <Form.Item {...rest} name={[name, "address"]} rules={[{ required: true, message: "必填" }]}>
                      <Input placeholder="192.168.1.1" style={{ width: 180 }} />
                    </Form.Item>
                    <Form.Item {...rest} name={[name, "label"]}>
                      <Input placeholder="标签(可选)" style={{ width: 160 }} />
                    </Form.Item>
                    <Button danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add({ address: "", label: "" })} block icon={<PlusOutlined />}>添加 IP</Button>
              </>
            )}
          </Form.List>

          <Title level={5} style={{ marginTop: 16 }}>MAC 地址</Title>
          <Form.List name="macs">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }) => (
                  <Space key={key} align="baseline" style={{ marginBottom: 6 }}>
                    <Form.Item {...rest} name={[name, "_id"]} hidden><Input /></Form.Item>
                    <Form.Item {...rest} name={[name, "address"]} rules={[{ required: true, message: "必填" }]}>
                      <Input placeholder="AA:BB:CC:DD:EE:FF" style={{ width: 180 }} />
                    </Form.Item>
                    <Form.Item {...rest} name={[name, "label"]}>
                      <Input placeholder="标签(可选)" style={{ width: 160 }} />
                    </Form.Item>
                    <Button danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add({ address: "", label: "" })} block icon={<PlusOutlined />}>添加 MAC</Button>
              </>
            )}
          </Form.List>

          <Divider />
          <Title level={5}>账号密码</Title>
          <Form.List name="accounts">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }) => (
                  <Space key={key} align="baseline" wrap style={{ width: "100%", marginBottom: 8 }}>
                    <Form.Item {...rest} name={[name, "_id"]} hidden><Input /></Form.Item>
                    <Form.Item {...rest} name={[name, "username"]} label="用户名" rules={[{ required: true }]}>
                      <Input placeholder="root" style={{ width: 130 }} />
                    </Form.Item>
                    <Form.Item {...rest} name={[name, "password"]} label="密码" rules={[{ required: !isEdit }]}>
                      <Input.Password placeholder={isEdit ? "留空则不修改" : "输入密码"} style={{ width: 170 }} />
                    </Form.Item>
                    <Form.Item label=" ">
                      <Tooltip title="生成强密码">
                        <Button icon={<ThunderboltOutlined />} onClick={() => form.setFieldValue(["accounts", name, "password"], generatePassword())} />
                      </Tooltip>
                    </Form.Item>
                    <Form.Item {...rest} name={[name, "notes"]} label="备注">
                      <Input placeholder="可选" style={{ width: 140 }} />
                    </Form.Item>
                    <Form.Item label=" ">
                      {isEdit && form.getFieldValue(["accounts", name, "_id"]) ? (
                        <Popconfirm title="删除此账号?" onConfirm={() => deleteAccount(form.getFieldValue(["accounts", name, "_id"]))}>
                          <Button danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      ) : (
                        <Button danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
                      )}
                    </Form.Item>
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add({ username: "", password: "", notes: "" })} block icon={<PlusOutlined />}>添加账号</Button>
              </>
            )}
          </Form.List>

          <Divider />
          <Title level={5}>附件</Title>
          {/* Existing files (edit mode) */}
          {isEdit && existingFiles.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {existingFiles.map((f: any) => (
                <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #f0f0f0" }}>
                  <Space>
                    <Tag>{f.file_type?.toUpperCase()}</Tag>
                    <span>{f.original_filename}</span>
                    <span style={{ color: "#999", fontSize: 12 }}>{formatSize(f.file_size)}</span>
                  </Space>
                  <Space size={4}>
                    <Button size="small" type="link" icon={<DownloadOutlined />}
                      onClick={async () => {
                        try {
                          const res = await api.get("/files/" + f.id + "/download", { responseType: "blob" });
                          const url = URL.createObjectURL(new Blob([res.data]));
                          const a = document.createElement("a");
                          a.href = url; a.download = f.original_filename; a.click();
                          URL.revokeObjectURL(url);
                        } catch { message.error("下载失败"); }
                      }}>下载</Button>
                    <Popconfirm title="确定删除此文件？" onConfirm={() => deleteFile(f.id)}>
                      <Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button>
                    </Popconfirm>
                  </Space>
                </div>
              ))}
            </div>
          )}
          {/* Pending files to upload */}
          {pendingFiles.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {pendingFiles.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #f0f0f0" }}>
                  <Space>
                    <Tag color="processing">待上传</Tag>
                    <span>{f.name}</span>
                    <span style={{ color: "#999", fontSize: 12 }}>{formatSize(f.size)}</span>
                  </Space>
                  <Button size="small" danger type="link" icon={<DeleteOutlined />}
                    onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}>移除</Button>
                </div>
              ))}
            </div>
          )}
          <Dragger
            multiple
            accept=".doc,.docx,.xls,.xlsx,.pdf,.png,.jpg,.jpeg,.gif,.bmp,.webp"
            showUploadList={false}
            beforeUpload={(file) => {
              const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
              const allowed = ['.doc','.docx','.xls','.xlsx','.pdf','.png','.jpg','.jpeg','.gif','.bmp','.webp'];
              if (!allowed.includes(ext)) {
                message.error(`不支持的文件类型: ${ext}`);
                return false;
              }
              if (file.size > 100 * 1024 * 1024) {
                message.error(`文件 ${file.name} 超过 100MB`);
                return false;
              }
              setPendingFiles(prev => [...prev, file]);
              return false;
            }}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">点击或拖拽文件到此处上传</p>
            <p className="ant-upload-hint">支持 Word、Excel、PDF、图片，单文件不超过 100MB</p>
          </Dragger>

          <Divider />
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} placeholder="补充说明" />
          </Form.Item>
          <Space>
            <Button type="primary" className="gradient-btn" htmlType="submit" loading={saving}>{isEdit ? "保存修改" : "创建设备"}</Button>
            <Button onClick={() => navigate("/devices")}>取消</Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
}
