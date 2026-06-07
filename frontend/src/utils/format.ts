import { COLOR } from '../theme/tokens';
import type { Direction } from '../types';

// 数字格式化：null/NaN 显示破折号；整数千分位；小数最多保留 digits 位
export function fmtNum(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  if (Number.isInteger(v)) return v.toLocaleString();
  return v.toLocaleString(undefined, { maximumFractionDigits: digits });
}

// 趋势染色：依据指标方向 + 涨跌，返回语义色
//  - higher_better：涨=绿(success)，跌=红(danger)
//  - lower_better ：涨=红，跌=绿（反转）
export function trendColor(delta: number, direction: Direction): string {
  if (!delta) return COLOR.inkSubtle;
  const good = direction === 'higher_better' ? delta > 0 : delta < 0;
  return good ? COLOR.success : COLOR.danger;
}

// 趋势箭头
export function trendArrow(delta: number): string {
  if (!delta) return '—';
  return delta > 0 ? '↑' : '↓';
}
