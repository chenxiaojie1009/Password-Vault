import type { ReactNode } from 'react';
import {
  CloudServerOutlined,
  ApartmentOutlined,
  ClusterOutlined,
  GatewayOutlined,
  SafetyCertificateOutlined,
  DatabaseOutlined,
  DesktopOutlined,
  HddOutlined,
  KeyOutlined,
  TeamOutlined,
  LoginOutlined,
  EditOutlined,
  DeleteOutlined,
  ExportOutlined,
  ImportOutlined,
  UploadOutlined,
  UnlockOutlined,
  PlusCircleOutlined,
} from '@ant-design/icons';

/** 设备类型 → 标签色 */
export const TYPE_COLORS: Record<string, string> = {
  服务器: 'blue',
  交换机: 'green',
  纵加设备: 'orange',
  路由器: 'purple',
  防火墙: 'red',
  存储设备: 'cyan',
  工作站: 'geekblue',
  其他: 'default',
};

/** 设备类型 → 渐变（卡片图标用） */
export const TYPE_GRADIENTS: Record<string, string> = {
  服务器: 'linear-gradient(135deg,#3b82f6,#6366f1)',
  交换机: 'linear-gradient(135deg,#10b981,#059669)',
  纵加设备: 'linear-gradient(135deg,#f59e0b,#ea580c)',
  路由器: 'linear-gradient(135deg,#8b5cf6,#6d28d9)',
  防火墙: 'linear-gradient(135deg,#ef4444,#dc2626)',
  存储设备: 'linear-gradient(135deg,#06b6d4,#0891b2)',
  工作站: 'linear-gradient(135deg,#6366f1,#4338ca)',
  其他: 'linear-gradient(135deg,#94a3b8,#64748b)',
};

/** 设备类型 → 图标 */
export const TYPE_ICONS: Record<string, ReactNode> = {
  服务器: <CloudServerOutlined />,
  交换机: <ApartmentOutlined />,
  纵加设备: <ClusterOutlined />,
  路由器: <GatewayOutlined />,
  防火墙: <SafetyCertificateOutlined />,
  存储设备: <DatabaseOutlined />,
  工作站: <DesktopOutlined />,
  其他: <HddOutlined />,
};

export const LEVEL_COLORS: Record<string, string> = {
  一级设备: 'blue',
  二级设备: 'green',
  三级设备: 'orange',
  四级设备: 'red',
};

export const ROLE_COLORS: Record<string, string> = {
  admin: 'red',
  operator: 'orange',
  editor: 'blue',
  viewer: 'green',
};

export const ROLE_LABELS: Record<string, string> = {
  admin: '管理员',
  operator: '运维者',
  editor: '编辑者',
  viewer: '查看者',
};

export const ROLE_MAX_LEVEL: Record<string, number> = { admin: 4, operator: 3, editor: 2, viewer: 1 };
export const LEVEL_NUM: Record<string, number> = { 一级设备: 1, 二级设备: 2, 三级设备: 3, 四级设备: 4 };

export function canEditDevice(role: string, deviceLevel: string): boolean {
  return (LEVEL_NUM[deviceLevel] || 1) <= (ROLE_MAX_LEVEL[role] || 1);
}

/** 操作类型 → 展示元数据 */
export const ACTION_META: Record<string, { label: string; color: string; gradient: string; icon: ReactNode }> = {
  create: { label: '创建', color: 'green', gradient: 'linear-gradient(135deg,#10b981,#059669)', icon: <PlusCircleOutlined /> },
  update: { label: '修改', color: 'blue', gradient: 'linear-gradient(135deg,#3b82f6,#6366f1)', icon: <EditOutlined /> },
  delete: { label: '删除', color: 'red', gradient: 'linear-gradient(135deg,#ef4444,#dc2626)', icon: <DeleteOutlined /> },
  export: { label: '导出', color: 'orange', gradient: 'linear-gradient(135deg,#f59e0b,#ea580c)', icon: <ExportOutlined /> },
  import: { label: '导入', color: 'purple', gradient: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', icon: <ImportOutlined /> },
  login: { label: '登录', color: 'cyan', gradient: 'linear-gradient(135deg,#06b6d4,#0891b2)', icon: <LoginOutlined /> },
  change_password: { label: '改密', color: 'geekblue', gradient: 'linear-gradient(135deg,#6366f1,#4338ca)', icon: <KeyOutlined /> },
  upload: { label: '上传', color: 'blue', gradient: 'linear-gradient(135deg,#0ea5e9,#2563eb)', icon: <UploadOutlined /> },
  create_user: { label: '创建用户', color: 'green', gradient: 'linear-gradient(135deg,#10b981,#0891b2)', icon: <TeamOutlined /> },
  update_user: { label: '更新用户', color: 'blue', gradient: 'linear-gradient(135deg,#3b82f6,#4f46e5)', icon: <TeamOutlined /> },
  delete_user: { label: '删除用户', color: 'red', gradient: 'linear-gradient(135deg,#ef4444,#be123c)', icon: <DeleteOutlined /> },
  reset_password: { label: '重置密码', color: 'orange', gradient: 'linear-gradient(135deg,#f59e0b,#d97706)', icon: <UnlockOutlined /> },
};

export const ACTION_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(ACTION_META).map(([k, v]) => [k, v.label]),
);
export const ACTION_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(ACTION_META).map(([k, v]) => [k, v.color]),
);

/** 统计卡片渐变色板 */
export const STAT_GRADIENTS = {
  blue: 'linear-gradient(135deg,#3b82f6,#6366f1)',
  mint: 'linear-gradient(135deg,#10b981,#3b82f6)',
  sunset: 'linear-gradient(135deg,#f59e0b,#ef4444)',
  candy: 'linear-gradient(135deg,#8b5cf6,#ec4899)',
  cyan: 'linear-gradient(135deg,#06b6d4,#3b82f6)',
};
