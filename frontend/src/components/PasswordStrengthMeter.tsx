import { useEffect, useState } from "react";
import { Progress, Typography } from "antd";
import api from "../api/client";

const { Text } = Typography;

interface StrengthInfo {
  score: number;
  level: string;
  feedback: string;
}

const levelMeta: Record<string, { color: string; label: string; percent: number }> = {
  weak: { color: "#ef4444", label: "弱", percent: 20 },
  fair: { color: "#f59e0b", label: "一般", percent: 45 },
  good: { color: "#3b82f6", label: "良好", percent: 70 },
  strong: { color: "#10b981", label: "强", percent: 100 },
};

export default function PasswordStrengthMeter({ password }: { password: string }) {
  const [info, setInfo] = useState<StrengthInfo | null>(null);

  useEffect(() => {
    if (!password) return;
    let cancelled = false;
    api.post("/password/check", { password })
      .then((res) => { if (!cancelled) setInfo(res.data); })
      .catch(() => { if (!cancelled) setInfo(null); });
    return () => { cancelled = true; };
  }, [password]);

  if (!password || !info) return null;
  const meta = levelMeta[info.level] || levelMeta.weak;

  return (
    <div style={{ marginTop: 4 }}>
      <Progress
        percent={meta.percent}
        showInfo={false}
        strokeColor={meta.color}
        trailColor="#eef1f7"
        size="small"
        style={{ marginBottom: 2 }}
      />
      <Text style={{ fontSize: 12, color: meta.color }}>密码强度：{meta.label}</Text>
      {info.feedback && <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>{info.feedback}</Text>}
    </div>
  );
}
