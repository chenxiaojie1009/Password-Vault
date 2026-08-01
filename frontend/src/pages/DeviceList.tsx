import { useState, useEffect, useCallback } from "react";
import { Table, Button, Input, Select, Space, Tag, Card, Popconfirm, message, Tooltip, Grid, Pagination } from "antd";
const { useBreakpoint } = Grid;
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, ExportOutlined, ImportOutlined, ReloadOutlined, EyeOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import DeviceModal from "../components/DeviceModal";

interface Device { id: number; name: string; device_type: string; ip_address: string; mac_address: string; account_count: number; is_network_involved: boolean; device_level: string; updated_at: string; }

const typeColors: Record<string, string> = { "服务器": "blue", "交换机": "green", "纵加设备": "orange", "路由器": "purple", "防火墙": "red", "存储设备": "cyan", "工作站": "geekblue", "其他": "default" };
const ROLE_MAX_LEVEL: Record<string, number> = { admin: 4, operator: 3, editor: 2, viewer: 1 };
const LEVEL_NUM: Record<string, number> = { "一级设备": 1, "二级设备": 2, "三级设备": 3, "四级设备": 4 };

function canEditDevice(role: string, deviceLevel: string): boolean {
  return (LEVEL_NUM[deviceLevel] || 1) <= (ROLE_MAX_LEVEL[role] || 1);
}

export default function DeviceList() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [typeOptions, setTypeOptions] = useState<string[]>(["服务器","交换机","纵加设备","路由器","防火墙","存储设备","工作站","其他"]);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const canEdit = user.role === "admin" || user.role === "editor";
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  useEffect(() => {
    api.get("/config/device_types").then(r => {
      const vals = r.data?.map((i: any) => i.value) || [];
      setTypeOptions(prev => [...new Set([...prev, ...vals])]);
    }).catch(() => {});
  }, []);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/devices", { params: { keyword: search || undefined, device_type: typeFilter || undefined, page, page_size: pageSize } });
      setDevices(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch { message.error("获取设备列表失败"); }
    finally { setLoading(false); }
  }, [page, pageSize, search, typeFilter]);

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
    { title: "分级", dataIndex: "device_level", width: 80, render: (v: string) => {
      const lc: Record<string,string>={"一级设备":"blue","二级设备":"green","三级设备":"orange","四级设备":"red"};
      return <Tag color={lc[v]||"default"}>{v}</Tag>;
    }},
    { title: "更新时间", dataIndex: "updated_at", width: 170, render: (t: string) => new Date(t).toLocaleString("zh-CN") },
    {
      title: "操作", width: 160,
      render: (_, record) => (
        <Space>
          <Tooltip title="查看"><Button type="link" size="small" icon={<EyeOutlined />}
            onClick={() => { setDetailId(record.id); setModalOpen(true); }} /></Tooltip>
          {canEditDevice(user.role, record.device_level) && (<>
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
            {canEdit && <Button icon={<ImportOutlined />} onClick={handleImport}>批量导入</Button>}
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/devices/new")}>添加设备</Button>
            <Button icon={<ExportOutlined />} onClick={handleExport}>导出</Button>
          </Space>
        </Space>
      </Card>
      {isMobile ? (
        <div style={{ marginTop: 12 }}>
          {devices.map(d => (
            <Card key={d.id} size="small" style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {d.is_network_involved && <Tag color="red" style={{ marginRight: 4 }}>涉网</Tag>}
                    {d.name}
                  </div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                    <Tag color={typeColors[d.device_type] || "default"}>{d.device_type}</Tag>
                    {d.ip_address && <span> IP: {d.ip_address}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "#aaa" }}>
                    账号: {d.account_count} · {new Date(d.updated_at).toLocaleString("zh-CN")}
                  </div>
                </div>
                <Space size={4}>
                  <Button size="small" onClick={() => { setDetailId(d.id); setModalOpen(true); }}>查看</Button>
                  {canEditDevice(user.role, d.device_level) && <Button size="small" onClick={() => navigate("/devices/" + d.id + "/edit")}>编辑</Button>}
                  {canEditDevice(user.role, d.device_level) && <Popconfirm title="确定删除？" onConfirm={() => handleDelete(d.id)}>
                    <Button size="small" danger>删除</Button>
                  </Popconfirm>}
                </Space>
              </div>
            </Card>
          ))}
          {!loading && devices.length === 0 && <div style={{ textAlign: "center", padding: 32, color: "#999" }}>暂无设备</div>}
          {total > pageSize && (
            <Pagination size="small" current={page} pageSize={pageSize} total={total}
              showSizeChanger showTotal={(t: number) => `共 ${t} 条`}
              onChange={(p, ps) => { setPage(p); if (ps !== pageSize) { setPageSize(ps); setPage(1); } }}
              style={{ textAlign: "center", marginTop: 12 }} />
          )}
        </div>
      ) : (
      <Table columns={columns} dataSource={devices} rowKey="id" loading={loading} style={{ marginTop: 16 }} scroll={{ x: 900 }}
        rowSelection={{ selectedRowKeys: selectedKeys, onChange: (keys) => setSelectedKeys(keys) }}
        pagination={{ current: page, pageSize: pageSize, total: total, showSizeChanger: true, showTotal: (t: number) => "共 " + t + " 条", onChange: (p, ps) => { setPage(p); if (ps && ps !== pageSize) { setPageSize(ps); setPage(1); } } }} />
      )}
      <DeviceModal open={modalOpen} detailId={detailId} editId={null}
        onClose={() => { setModalOpen(false); setDetailId(null); }} />
    </div>
  );
}
