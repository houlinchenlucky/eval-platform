import ReactECharts from 'echarts-for-react';
import type { MetricWithTrend } from '../types';
import { makeBaseOption, axisCommon } from '../theme/echartsTheme';
import { COLOR, CHART_PALETTE, FONT } from '../theme/tokens';

interface Props {
  metrics: MetricWithTrend[];
}

export default function GroupBarChart({ metrics }: Props) {
  // 反转顺序：ECharts 从下往上渲染，反转后第一个指标显示在最上方
  const ordered = [...metrics].reverse();
  const names = ordered.map((m) => m.name);
  const hasPrev = ordered.some((m) => m.platform_prev_value != null || m.prev_value != null);

  const base = makeBaseOption();

  const option = {
    ...base,
    legend: hasPrev
      ? { ...base.legend, data: ['上期', '本期'], top: 8 }
      : { show: false },
    grid: {
      left: 16,
      right: 100,
      top: hasPrev ? 44 : 12,
      bottom: 8,
      containLabel: true,
    },
    tooltip: {
      ...base.tooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(255,255,255,0.03)' } },
    },
    xAxis: {
      type: 'value',
      ...axisCommon,
      splitLine: { lineStyle: { color: COLOR.hairline, width: 1 } },
    },
    yAxis: {
      type: 'category',
      data: names,
      ...axisCommon,
      axisLabel: {
        ...axisCommon.axisLabel,
        width: 130,
        overflow: 'truncate',
      },
    },
    series: [
      ...(hasPrev
        ? [
            {
              name: '上期',
              type: 'bar',
              data: ordered.map((m) => m.platform_prev_value ?? m.prev_value ?? null),
              barMaxWidth: 14,
              itemStyle: {
                color: `${COLOR.inkSubtle}28`,
                borderColor: `${COLOR.inkSubtle}60`,
                borderWidth: 1,
                borderRadius: [0, 4, 4, 0],
              },
              label: { show: false },
            },
          ]
        : []),
      {
        name: '本期',
        type: 'bar',
        barMaxWidth: 14,
        data: ordered.map((m) => {
          const neutral = m.delta == null || m.delta === 0;
          const improved =
            m.delta != null &&
            (m.direction === 'lower_better' ? m.delta < 0 : m.delta > 0);
          const color = neutral
            ? CHART_PALETTE[0]
            : improved
            ? COLOR.success
            : COLOR.danger;
          return { value: m.value, itemStyle: { color, borderRadius: [0, 4, 4, 0] } };
        }),
        label: {
          show: true,
          position: 'right',
          fontSize: 12,
          fontFamily: FONT.mono,
          formatter: (params: any) => {
            const m = ordered[params.dataIndex];
            if (m.delta == null || m.delta === 0) {
              return `{val|${params.value}}`;
            }
            const improved =
              m.direction === 'lower_better' ? m.delta < 0 : m.delta > 0;
            const sign = m.delta > 0 ? '+' : '';
            const cls = improved ? 'pos' : 'neg';
            return `{val|${params.value}}  {${cls}|${sign}${m.delta}}`;
          },
          rich: {
            val: {
              color: COLOR.ink,
              fontFamily: FONT.mono,
              fontSize: 13,
              fontWeight: 600,
            },
            pos: {
              color: COLOR.success,
              fontFamily: FONT.mono,
              fontSize: 11,
            },
            neg: {
              color: COLOR.danger,
              fontFamily: FONT.mono,
              fontSize: 11,
            },
          },
        },
      },
    ],
  };

  const rowH = hasPrev ? 52 : 38;
  const topPad = hasPrev ? 56 : 28;
  const height = Math.max(180, ordered.length * rowH + topPad);

  return (
    <ReactECharts option={option} style={{ height }} notMerge lazyUpdate />
  );
}
