import { useState, useEffect } from "react";
import { Card, Row, Col, Table, Tag, Spin, Empty, Alert } from "antd";
import {
  CloudServerOutlined,
  KeyOutlined,
  TeamOutlined,
  FileDoneOutlined,
  DashboardOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import api from "../api/client";

const typeColors: Record<string, string> = {
  "服务器": "blue", "交换机": "green", "纵加设备": "orange", "路由器": "purple",
  "防火墙": "red", "存储设备": "cyan", "工作站": "geekblue", "其他": "default",
};

const actionLabels: Record<string, string> = {
  create: "创建", update: "修改", delete: "删除", export: "导出",
  import: "导入", login: "登录", change_password: "改密", upload: "上传",
  create_user: "创建用户", update_user: "更新用户", delete_user: "删除用户",
  reset_password: "重置密码",
};
const actionColors: Record<string, string> = {
  create: "green", update: "blue", delete: "red", export: "orange",
  import: "purple", login: "cyan", change_password: "geekblue", upload: "blue",
  create_user: "green", update_user: "blue", delete_user: "red", reset_password: "orange",
};

interface DashData {
  device_count: number;
  account_count: number;
  user_count: number;
  today_logs: number;
  weak_password_count?: number;
  type_stats: Record<string, number>;
  recent_logs: { id: number; username: string; action: string; target_type: string; detail: string; created_at: string }[];
}

/** 数字滚动动画 */
function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const target = value || 0;
    const duration = 800;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{display}</>;
}

export default function Dashboard() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user.role === "admin";

  useEffect(() => {
    api.get("/dashboard")
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  const stats = [
    { title: "设备总数", value: data?.device_count ?? 0, icon: <CloudServerOutlined />, grad: "linear-gradient(135deg,#3b82f6,#6366f1)" },
    { title: "账号总数", value: data?.account_count ?? 0, icon: <KeyOutlined />, grad: "linear-gradient(135deg,#10b981,#3b82f6)" },
    { title: "用户总数", value: data?.user_count ?? 0, icon: <TeamOutlined />, grad: "linear-gradient(135deg,#f59e0b,#ef4444)" },
    { title: "今日操作", value: data?.today_logs ?? 0, icon: <FileDoneOutlined />, grad: "linear-gradient(135deg,#8b5cf6,#ec4899)" },
  ];

  const typeEntries = Object.entries(data?.type_stats || {}).sort((a, b) => b[1] - a[1]);
  const totalDevices = data?.device_count || 0;

  const recentColumns = [
    { title: "时间", dataIndex: "created_at", width: 170, render: (v: string) => (v ? dayjs(v).format("YYYY-MM-DD HH:mm:ss") : "-") },
    { title: "用户", dataIndex: "username", width: 110 },
    {
      title: "操作", dataIndex: "action", width: 110,
      render: (v: string) => <Tag color={actionColors[v] || "default"}>{actionLabels[v] || v}</Tag>,
    },
    { title: "对象", dataIndex: "target_type", width: 80 },
    { title: "详情", dataIndex: "detail", ellipsis: true },
  ];

  return (
    <div className="page-transition">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{
          width: 34, height: 34, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", color: "#fff", boxShadow: "0 4px 12px rgba(59,130,246,0.4)",
        }}><DashboardOutlined /></span>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>数据概览</div>
          <div style={{ color: "#94a3b8", fontSize: 13 }}>设备与账号集中管理总览</div>
        </div>
      </div>

      {(data?.weak_password_count ?? 0) > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16, borderRadius: 12 }}
          message={`发现 ${data?.weak_password_count} 个弱密码账户`}
          description="建议尽快将这些账户的密码修改为强密码（至少 8 位，包含大小写字母、数字与特殊字符）。"
        />
      )}

      <Row gutter={[16, 16]} className="stagger">
        {stats.map((s) => (
          <Col xs={24} sm={12} lg={6} key={s.title}>
            <Card className="glass-card hover-lift" styles={{ body: { padding: 20 } }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 6 }}>{s.title}</div>
                  <div className="stat-value" style={{ fontSize: 32, lineHeight: 1 }}><AnimatedNumber value={s.value} /></div>
                </div>
                <div style={{
                  width: 52, height: 52, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
                  background: s.grad, color: "#fff", fontSize: 24, boxShadow: "0 6px 16px rgba(59,130,246,0.3)",
                }}>{s.icon}</div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={10}>
          <Card title="设备类型分布" className="glass-card" styles={{ body: { paddingTop: 8 } }}>
            {typeEntries.length === 0 ? <Empty description="暂无设备" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
              typeEntries.map(([t, c]) => (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <Tag color={typeColors[t] || "default"} style={{ minWidth: 60, textAlign: "center", marginRight: 0 }}>{t}</Tag>
                  <div style={{ flex: 1, height: 8, background: "#eef1f7", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      width: totalDevices ? `${Math.round((c / totalDevices) * 100)}%` : "0%",
                      height: "100%", borderRadius: 4,
                      background: "linear-gradient(90deg,#3b82f6,#8b5cf6)",
                      transition: "width 0.6s cubic-bezier(0.22,1,0.36,1)",
                    }} />
                  </div>
                  <span style={{ color: "#64748b", fontSize: 13, minWidth: 24, textAlign: "right" }}>{c}</span>
                </div>
              ))
            )}
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card title="最近活动" className="glass-card" styles={{ body: { paddingTop: 8 } }}>
            {isAdmin ? (
              <Table
                rowKey="id"
                columns={recentColumns}
                dataSource={data?.recent_logs || []}
                pagination={false}
                size="small"
                locale={{ emptyText: "暂无操作记录" }}
              />
            ) : (
              <Empty description="仅管理员可查看操作日志" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
