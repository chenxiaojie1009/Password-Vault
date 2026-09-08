import type { ReactNode } from 'react';
import { Card } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import AnimatedNumber from './AnimatedNumber';
import Sparkline from './Sparkline';

interface Props {
  title: string;
  value: number;
  icon: ReactNode;
  gradient?: string;
  suffix?: string;
  /** 趋势百分比，正数向上 */
  trend?: number;
  spark?: number[];
  hint?: ReactNode;
  delay?: number;
  onClick?: () => void;
}

/** 数据概览统计卡片：渐变图标 + 数字滚动 + 迷你趋势 */
export default function StatCard({
  title,
  value,
  icon,
  gradient = 'linear-gradient(135deg,#3b82f6,#6366f1)',
  suffix,
  trend,
  spark,
  hint,
  delay = 0,
  onClick,
}: Props) {
  const up = (trend ?? 0) >= 0;
  return (
    <Card
      className="glass-card hover-lift top-sheen"
      onClick={onClick}
      style={{
        animation: 'fadeInUp .5s cubic-bezier(0.22,1,0.36,1) both',
        animationDelay: `${delay}ms`,
        cursor: onClick ? 'pointer' : undefined,
        height: '100%',
      }}
      styles={{ body: { padding: 20 } }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 8 }}>{title}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <AnimatedNumber value={value} className="stat-value" />
            {suffix && <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{suffix}</span>}
          </div>
          {(trend !== undefined || hint) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, minHeight: 22 }}>
              {trend !== undefined && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 999,
                    color: up ? '#059669' : '#dc2626',
                    background: up ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                  }}
                >
                  {up ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                  {Math.abs(trend).toFixed(1)}%
                </span>
              )}
              {hint && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{hint}</span>}
            </div>
          )}
        </div>
        <div
          className="icon-badge"
          style={{ width: 52, height: 52, borderRadius: 15, fontSize: 23, background: gradient }}
        >
          {icon}
        </div>
      </div>
      {spark && spark.length > 1 && (
        <div style={{ marginTop: 14, marginBottom: -6 }}>
          <Sparkline data={spark} color={gradient.includes('10b981') ? '#10b981' : gradient.includes('f59e0b') ? '#f59e0b' : gradient.includes('8b5cf6') ? '#8b5cf6' : '#3b82f6'} />
        </div>
      )}
    </Card>
  );
}
