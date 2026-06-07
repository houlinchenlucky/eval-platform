import { COLOR, CHART_PALETTE, FONT } from './tokens';

// 对应「设计规范.md」§3 —— ECharts 暗色主题约定
export { CHART_PALETTE };

// 坐标轴通用样式：网格线用 hairline，标签用 Mono + ink-subtle
export const axisCommon = {
  axisLine: { show: true, lineStyle: { color: COLOR.hairline } },
  axisTick: { show: false },
  axisLabel: { color: COLOR.inkSubtle, fontFamily: FONT.mono, fontSize: 12 },
  splitLine: { lineStyle: { color: COLOR.hairline, type: 'solid' as const } },
};

// 所有图表都 spread 这个基础 option，保证统一的暗色风格。
// 图表背景透明（继承所在 surface-1 卡片），不单独给底色。
export function makeBaseOption(): Record<string, any> {
  return {
    color: [...CHART_PALETTE],
    backgroundColor: 'transparent',
    textStyle: { fontFamily: FONT.sans, color: COLOR.inkMuted },
    grid: { left: 16, right: 24, top: 48, bottom: 16, containLabel: true },
    legend: {
      top: 8,
      textStyle: { color: COLOR.inkMuted, fontFamily: FONT.sans },
      inactiveColor: COLOR.inkTertiary,
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 12,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: COLOR.surface3,
      borderColor: COLOR.hairlineStrong,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: COLOR.ink, fontFamily: FONT.sans, fontSize: 13 },
      axisPointer: { type: 'line', lineStyle: { color: COLOR.hairlineStrong } },
    },
  };
}
