import { useEffect, useState } from 'react';
import { ProgressRing } from './ui';
import api from '../api/client';

interface StrengthInfo {
  score: number;
  level: string;
  feedback: string;
}

const levelMeta: Record<string, { color: string; label: string; percent: number; filled: number }> = {
  weak: { color: '#ef4444', label: '弱', percent: 22, filled: 1 },
  fair: { color: '#f59e0b', label: '一般', percent: 48, filled: 2 },
  good: { color: '#3b82f6', label: '良好', percent: 74, filled: 3 },
  strong: { color: '#10b981', label: '强', percent: 100, filled: 4 },
};

/** 密码强度：环形进度 + 分段强度条 + 改进建议 */
export default function PasswordStrengthMeter({ password }: { password: string }) {
  const [info, setInfo] = useState<StrengthInfo | null>(null);

  useEffect(() => {
    if (!password) {
      setInfo(null);
      return;
    }
    let cancelled = false;
    api
      .post('/password/check', { password })
      .then((res) => {
        if (!cancelled) setInfo(res.data);
      })
      .catch(() => {
        if (!cancelled) setInfo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [password]);

  if (!password || !info) return null;
  const meta = levelMeta[info.level] || levelMeta.weak;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '12px 14px',
        borderRadius: 14,
        background: 'rgba(100,116,139,0.06)',
        border: '1px solid var(--line)',
        animation: 'scaleIn .3s cubic-bezier(0.22,1,0.36,1) both',
      }}
    >
      <ProgressRing percent={meta.percent} size={68} thickness={7} color={meta.color}>
        <span style={{ fontSize: 15, fontWeight: 700, color: meta.color }}>{meta.label}</span>
      </ProgressRing>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="seg-bar">
          {[0, 1, 2, 3].map((i) => (
            <span key={i}>
              {i < meta.filled && (
                <i style={{ background: meta.color, animationDelay: `${i * 60}ms` }} />
              )}
            </span>
          ))}
        </div>
        <div style={{ fontSize: 12.5, color: meta.color, marginTop: 9, fontWeight: 600 }}>
          密码强度：{meta.label}
        </div>
        {info.feedback && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>
            {info.feedback}
          </div>
        )}
      </div>
    </div>
  );
}
