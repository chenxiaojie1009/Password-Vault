import { useState, useEffect, useCallback } from "react";
import { Table, Button, Input, Select, Space, Tag, Card, Popconfirm, message, Tooltip } from "antd";
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, ExportOutlined, ImportOutlined, ReloadOutlined, EyeOutlined, DownloadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import DeviceModal from "../components/DeviceModal";

interface Device { id: number; name: string; device_type: string; ip_address: string; mac_address: string; account_count: number; is_network_involved: boolean; updated_at: string; }

const typeColors: Record<string, string> = { "服务器": "blue", "交换机": "green", "纵加设备": "orange", "路由器": "purple", "防火墙": "red", "存储设备": "cyan", "工作站": "geekblue", "其他": "default" };

export default function DeviceList() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [typeOptions, setTypeOptions] = useState<string[]>(["服务器","交换机","纵加设备","路由器","防火墙","存储设备","工作站","其他"]);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const canEdit = user.role === "admin" || user.role === "editor";

  useEffect(() => {
    api.get("/config/device_types").then(r => {
      const vals = r.data?.map((i: any) => i.value) || [];
      setTypeOptions(prev => [...new Set([...prev, ...vals])]);
    }).catch(() => {});
  }, []);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/devices", { params: { keyword: search || undefined, device_type: typeFilter || undefined, page, page_size: 20 } });
      setDevices(res.data);
    } catch { message.error("获取设备列表失败"); }
    finally { setLoading(false); }
  }, [page, search, typeFilter]);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const handleDelete = async (id: number) => {
    try { await api.delete("/devices/" + id); message.success("已删除"); fetchDevices(); }
    catch { message.error("删除失败"); }
  };

  const handleExport = async () => {
    try {
      const res = await api.post("/export", { format: "xlsx" }, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a"); a.href = url;
      a.download = "设备列表_" + new Date().toISOString().slice(0, 10) + ".xlsx";
      a.click(); URL.revokeObjectURL(url);
      message.success("导出成功");
    } catch { message.error("导出失败"); }
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

  const handleImport = () => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".xlsx,.xls";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]; if (!file) return;
      const fd = new FormData(); fd.append("file", file);
      try {
        const res = await api.post("/import/xlsx", fd);
        message.success("导入完成：共 " + res.data.total + " 条，成功 " + res.data.success);
        fetchDevices();
      } catch { message.error("导入失败"); }
    };
    input.click();
  };

  const columns: ColumnsType<Device> = [
    { title: "设备名称", dataIndex: "name", width: 180 },
    { title: "类型", dataIndex: "device_type", width: 100, render: (t: string) => <Tag color={typeColors[t] || "default"}>{t}</Tag> },
    { title: "IP 地址", dataIndex: "ip_address", width: 150 },
    { title: "MAC 地址", dataIndex: "mac_address", width: 160 },
    { title: "账号数", dataIndex: "account_count", width: 80, align: "center" as const },
    { title: "涉网", dataIndex: "is_network_involved", width: 60, align: "center" as const, render: (v: boolean) => v ? <Tag color="red">是</Tag> : <Tag>否</Tag> },
    { title: "更新时间", dataIndex: "updated_at", width: 170, render: (t: string) => new Date(t).toLocaleString("zh-CN") },
    {
      title: "操作", width: 160,
      render: (_, record) => (
        <Space>
          <Tooltip title="查看"><Button type="link" size="small" icon={<EyeOutlined />}
            onClick={() => { setDetailId(record.id); setModalOpen(true); }} /></Tooltip>
          {canEdit && (<>
            <Tooltip title="编辑"><Button type="link" size="small" icon={<EditOutlined />}
              onClick={() => navigate("/devices/" + record.id + "/edit")} /></Tooltip>
            <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
              <Tooltip title="删除"><Button type="link" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
            </Popconfirm>
          </>)}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card styles={{ body: { paddingBottom: 0 } }}>
        <Space wrap style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }}>
          <Space wrap>
            <Input placeholder="搜索名称/IP/MAC" prefix={<SearchOutlined />} value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} allowClear style={{ width: 220 }} />
            <Select placeholder="设备类型" value={typeFilter || undefined} allowClear style={{ width: 130 }}
              onChange={(v) => { setTypeFilter(v || ""); setPage(1); }}
              options={typeOptions.map(t=>({label:t,value:t}))} />
            <Button icon={<ReloadOutlined />} onClick={fetchDevices}>刷新</Button>
          </Space>
          <Space>
            {canEdit && (<>
              <Button icon={<ImportOutlined />} onClick={handleImport}>批量导入</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/devices/new")}>添加设备</Button>
            </>)}
            <Button icon={<ExportOutlined />} onClick={handleExport}>导出</Button>
          </Space>
        </Space>
      </Card>
      <Table columns={columns} dataSource={devices} rowKey="id" loading={loading} style={{ marginTop: 16 }}
        rowSelection={{ selectedRowKeys: selectedKeys, onChange: (keys) => setSelectedKeys(keys) }}
        pagination={{ current: page, pageSize: 20, showSizeChanger: true, showTotal: (t) => "共 " + t + " 条", onChange: (p) => setPage(p) }} />
      <DeviceModal open={modalOpen} detailId={detailId} editId={null}
        onClose={() => { setModalOpen(false); setDetailId(null); }} />
    </div>
  );
}
