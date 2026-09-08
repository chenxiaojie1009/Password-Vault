import { useEffect, useId, useRef, useState } from 'react';

interface Props {
  data: number[];
  height?: number;
  color?: string;
  /** 是否显示面积填充 */
  area?: boolean;
}

/** 迷你趋势折线图（带绘制动画） */
export default function Sparkline({ data, height = 40, color = '#3b82f6', area = true }: Props) {
  const gid = useId().replace(/:/g, '');
  const pathRef = useRef<SVGPathElement>(null);
  const [len, setLen] = useState(0);

  const points = data.length > 1 ? data : [0, 0];
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = max - min || 1;
  const w = 100;
  const h = 100;
  const pad = 6;

  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });

  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const areaPath = `${line} L${w},${h} L0,${h} Z`;

  useEffect(() => {
    const el = pathRef.current;
    if (!el) return;
    try {
      setLen(el.getTotalLength());
    } catch {
      setLen(0);
    }
  }, [line]);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height, display: 'block', overflow: 'visible' }}
      aria-hidden
    >
      <defs>
        <linearGradient id={`spark-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {area && <path d={areaPath} fill={`url(#spark-${gid})`} style={{ animation: 'fadeIn .8s ease both' }} />}
      <path
        ref={pathRef}
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={
          len
            ? { strokeDasharray: len, strokeDashoffset: 0, animation: `drawLine .9s cubic-bezier(0.22,1,0.36,1) both`, ['--line-len' as string]: `${len}` }
            : undefined
        }
      />
      {coords.length > 0 && (
        <circle cx={coords[coords.length - 1][0]} cy={coords[coords.length - 1][1]} r="2.6" fill={color}
          style={{ animation: 'popIn .5s .5s cubic-bezier(0.22,1,0.36,1) both' }} />
      )}
    </svg>
  );
}
