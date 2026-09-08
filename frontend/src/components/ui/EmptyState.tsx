import type { ReactNode } from 'react';
import { Button } from 'antd';

interface Props {
  icon?: ReactNode;
  title?: string;
  description?: ReactNode;
  actionText?: string;
  onAction?: () => void;
  compact?: boolean;
}

/** 空状态：柔和图标 + 引导操作 */
export default function EmptyState({
  icon,
  title = '暂无数据',
  description,
  actionText,
  onAction,
  compact = false,
}: Props) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: compact ? '24px 12px' : '44px 16px',
        animation: 'fadeIn .5s ease both',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          margin: '0 auto 14px',
          borderRadius: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          color: '#93c5fd',
          background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(139,92,246,0.12))',
          animation: 'floaty 5s ease-in-out infinite',
        }}
      >
        {icon}
      </div>
      <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{title}</div>
      {description && (
        <div style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 360, margin: '0 auto' }}>
          {description}
        </div>
      )}
      {actionText && onAction && (
        <Button type="primary" className="gradient-btn" style={{ marginTop: 16 }} onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
}
