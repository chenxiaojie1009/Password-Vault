import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number;
  /** 动画时长（毫秒） */
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
  /** 自定义格式化，默认千分位取整 */
  formatter?: (value: number) => string;
}

/** 数字滚动动画：从上一个值缓动到新值 */
export default function AnimatedNumber({ value, duration = 900, className, style, formatter }: Props) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const target = Number.isFinite(value) ? value : 0;
    if (from === target) {
      setDisplay(target);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (target - from) * eased);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <span className={className} style={style}>
      {formatter ? formatter(display) : Math.round(display).toLocaleString('zh-CN')}
    </span>
  );
}
