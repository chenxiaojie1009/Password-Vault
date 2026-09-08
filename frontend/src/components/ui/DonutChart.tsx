import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface Props {
  data: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: ReactNode;
  centerValue?: ReactNode;
}

/** 环形占比图：扇区依次扫出 */
export default function DonutChart({
  data,
  size = 180,
  thickness = 18,
  centerLabel,
  centerValue,
}: Props) {
  const [progress, setProgress] = useState(0);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const gap = data.length > 1 ? 2.5 : 0;

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 850);
      setProgress(1 - Math.pow(1 - p, 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [total]);

  const lenOf = (v: number) => (total ? (v / total) * c : 0);
  const slices = data.map((d, i) => ({
    ...d,
    len: lenOf(d.value),
    offset: data.slice(0, i).reduce((sum, x) => sum + lenOf(x.value), 0),
  }));

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(100,116,139,0.12)"
          strokeWidth={thickness}
        />
        {slices.map((s) => (
          <circle
            key={s.label}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`${Math.max(0, s.len * progress - gap)} ${c}`}
            strokeDashoffset={-s.offset}
            style={{ transition: 'stroke-dasharray .12s linear' }}
          />
        ))}
      </g>
      <foreignObject x="0" y="0" width={size} height={size} pointerEvents="none">
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
          }}
        >
          <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1 }} className="gradient-text">
            {centerValue}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{centerLabel}</div>
        </div>
      </foreignObject>
    </svg>
  );
}
