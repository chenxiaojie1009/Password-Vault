import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, Form, Input, Select, Button, Space, Divider, message, Popconfirm, Typography } from "antd";
import { ArrowLeftOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import api from "../api/client";

const { Title } = Typography;
const DEVICE_TYPES = ["服务器", "交换机", "纵加设备", "路由器", "防火墙", "存储设备", "其他"];

export default function DeviceForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const isEdit = !!id;

  useEffect(() => {
    if (id) {
      setLoading(true);
      api.get("/devices/" + id)
        .then((res) => {
          const d = res.data;
          form.setFieldsValue({
            name: d.name, device_type: d.device_type,
            location: d.location, notes: d.notes,
            ips: (d.ips || []).map((ip: any) => ({ address: ip.address, label: ip.label, _id: ip.id })),
            macs: (d.macs || []).map((m: any) => ({ address: m.address, label: m.label, _id: m.id })),
            accounts: (d.accounts || []).map((a: any) => ({
              username: a.username, password: "", notes: a.notes, _id: a.id,
            })),
          });
        })
        .catch(() => message.error("加载设备失败"))
        .finally(() => setLoading(false));
    }
  }, [id, form]);

  const onFinish = async (values: any) => {
    setSaving(true);
    try {
      const payload = {
        name: values.name, device_type: values.device_type,
        location: values.location, notes: values.notes,
        ips: (values.ips || []).map((x: any) => ({ address: x.address, label: x.label || "" })),
        macs: (values.macs || []).map((x: any) => ({ address: x.address, label: x.label || "" })),
        accounts: (values.accounts || []).map((a: any) => ({
          username: a.username, password: a.password, notes: a.notes,
        })),
      };

      if (isEdit) {
        await api.put("/devices/" + id, payload);
        // Update account passwords individually
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
      } else {
        await api.post("/devices", payload);
        message.success("设备已创建");
      }
      navigate("/");
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

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/")}>返回</Button>
        <Title level={4} style={{ margin: 0 }}>{isEdit ? "编辑设备" : "添加设备"}</Title>
      </Space>
      <Card loading={loading}>
        <Form form={form} layout="vertical" onFinish={onFinish}
          initialValues={{ device_type: "其他", ips: [{ address: "", label: "" }], macs: [{ address: "", label: "" }], accounts: [{ username: "", password: "", notes: "" }] }}>
          <Title level={5}>基本信息</Title>
          <Space style={{ width: "100%" }} size={16}>
            <Form.Item name="name" label="设备名称" rules={[{ required: true }]} style={{ width: 260 }}>
              <Input placeholder="如：核心交换机-A01" />
            </Form.Item>
            <Form.Item name="device_type" label="设备类型" rules={[{ required: true }]} style={{ width: 150 }}>
              <Select options={DEVICE_TYPES.map((t) => ({ label: t, value: t }))} />
            </Form.Item>
          </Space>
          <Form.Item name="location" label="位置">
            <Input placeholder="如：机房A" style={{ width: 300 }} />
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
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} placeholder="补充说明" />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>{isEdit ? "Save" : "Create"}</Button>
            <Button onClick={() => navigate("/")}>取消</Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
}

