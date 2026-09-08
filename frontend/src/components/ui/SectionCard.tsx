import type { ReactNode } from 'react';
import { Card } from 'antd';
import type { CardProps } from 'antd';

interface Props extends CardProps {
  icon?: ReactNode;
  title: ReactNode;
  extra?: ReactNode;
  bodyStyle?: React.CSSProperties;
}

/** 带图标的玻璃分区卡片 */
export default function SectionCard({ icon, title, extra, bodyStyle, children, ...rest }: Props) {
  return (
    <Card
      className="glass-card top-sheen"
      {...rest}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
          {icon && (
            <span
              className="icon-badge"
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                fontSize: 13,
                background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
              }}
            >
              {icon}
            </span>
          )}
          {title}
        </span>
      }
      extra={extra}
      styles={{ ...(rest.styles || {}), body: { paddingTop: 14, ...bodyStyle } }}
    >
      {children}
    </Card>
  );
}
