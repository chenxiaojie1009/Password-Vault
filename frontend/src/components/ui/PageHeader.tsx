import type { CSSProperties, ReactNode } from 'react';

interface Props {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** 右侧操作区 */
  extra?: ReactNode;
  /** 左侧附加内容（如返回按钮） */
  leading?: ReactNode;
  gradient?: string;
  style?: CSSProperties;
}

/** 统一的页面标题行：渐变图标 + 标题 + 副标题 + 操作区 */
export default function PageHeader({ icon, title, subtitle, extra, leading, gradient, style }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        marginBottom: 18,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        {leading}
        {icon && (
          <span className="icon-badge page-icon" style={gradient ? { background: gradient } : undefined}>
            {icon}
          </span>
        )}
        <div style={{ minWidth: 0 }}>
          <div className="page-title">{title}</div>
          {subtitle && <div className="page-subtitle">{subtitle}</div>}
        </div>
      </div>
      {extra && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{extra}</div>}
    </div>
  );
}
