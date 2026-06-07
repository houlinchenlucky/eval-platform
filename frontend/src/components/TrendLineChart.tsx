import ReactECharts from 'echarts-for-react';
import { makeBaseOption, axisCommon } from '../theme/echartsTheme';
import { COLOR } from '../theme/tokens';

interface Props {
  x: string[];
  series: { name: string; data: number[] }[];
  height?: number;
}

// 折线趋势图：时间回溯（设计规范 §11.4）。单条序列时填充淡面积。
export default function TrendLineChart({ x, series, height = 360 }: Props) {
  if (!series.length || !x.length) {
    return (
      <div style={{ height, display: 'grid', placeItems: 'center', color: COLOR.inkTertiary }}>
        选择报告与指标后展示趋势
      </div>
    );
  }
  const base = makeBaseOption();
  const option = {
    ...base,
    grid: { left: 16, right: 24, top: 48, bottom: 16, containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: x, ...axisCommon },
    yAxis: { type: 'value', ...axisCommon },
    series: series.map((s) => ({
      name: s.name,
      type: 'line',
      data: s.data,
      smooth: false,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 2 },
      emphasis: { lineStyle: { width: 3 } },
      areaStyle: series.length === 1 ? { opacity: 0.1 } : undefined,
    })),
  };
  return <ReactECharts option={option} style={{ height }} notMerge lazyUpdate />;
}
