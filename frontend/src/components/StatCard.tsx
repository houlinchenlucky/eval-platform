import { Card } from 'antd';
import { COLOR, FONT, SPACE } from '../theme/tokens';

interface Props {
  label: string; // eyebrow 标签
  value: string | number; // 大数字（Mono）
  suffix?: string;
  hint?: string;
  trend?: { text: string; color: string };
}

// 统计卡：eyebrow 标签 + Mono 大数字 + 可选趋势/说明（设计规范 §9 stat-card）
export default function StatCard({ label, value, suffix, hint, trend }: Props) {
  return (
    <Card styles={{ body: { padding: SPACE.lg } }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: '0.4px',
          color: COLOR.inkSubtle,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div style={{ marginTop: SPACE.sm, display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 28,
            fontWeight: 600,
            color: COLOR.ink,
            letterSpacing: 0,
          }}
        >
          {value}
        </span>
        {suffix && <span style={{ color: COLOR.inkSubtle, fontSize: 13 }}>{suffix}</span>}
        {trend && <span style={{ color: trend.color, fontSize: 13, marginLeft: 4 }}>{trend.text}</span>}
      </div>
      {hint && <div style={{ marginTop: 4, color: COLOR.inkTertiary, fontSize: 12 }}>{hint}</div>}
    </Card>
  );
}
