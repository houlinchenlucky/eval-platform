import ReactECharts from 'echarts-for-react';
import type { ChartData } from '../types';
import { makeBaseOption, axisCommon } from '../theme/echartsTheme';
import { COLOR } from '../theme/tokens';

// 分组柱状图：单份报告里每个指标一组柱子（设计规范 §11.3）
export default function MetricBarChart({ data, height = 360 }: { data: ChartData; height?: number }) {
  const base = makeBaseOption();
  const option = {
    ...base,
    tooltip: {
      ...base.tooltip,
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(94,106,210,0.08)' } },
    },
    xAxis: { type: 'category', data: data.categories, ...axisCommon },
    yAxis: { type: 'value', ...axisCommon },
    series: data.series.map((s) => ({
      name: s.name,
      type: 'bar',
      data: s.data,
      barMaxWidth: 28,
      itemStyle: { borderRadius: [4, 4, 0, 0] },
    })),
  };
  if (!data.series.length) {
    return (
      <div style={{ height, display: 'grid', placeItems: 'center', color: COLOR.inkTertiary }}>
        暂无图表数据
      </div>
    );
  }
  return <ReactECharts option={option} style={{ height }} notMerge lazyUpdate />;
}
