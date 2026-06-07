import { useState } from 'react';
import ReactECharts from 'echarts-for-react';
import type { CrossCell, Direction } from '../types';
import { makeBaseOption } from '../theme/echartsTheme';
import { COLOR, FONT, SPACE } from '../theme/tokens';

interface Props {
  group: string;
  metricName: string;
  direction: Direction;
  rowVals: string[];
  colVals: string[];
  cells: CrossCell[];
}

export default function CrossHeatmap({
  metricName,
  direction,
  rowVals,
  colVals,
  cells,
}: Props) {
  const [mode, setMode] = useState<'value' | 'delta'>('value');

  // 构建格子索引：(cross_row, cross_col) → cell
  const cellMap = new Map<string, CrossCell>();
  for (const c of cells) {
    cellMap.set(`${c.cross_row}|${c.cross_col}`, c);
  }

  const hasDelta = cells.some((c) => c.delta != null);

  // ECharts heatmap data: [colIdx, rowIdx, value]
  const data: [number, number, number | null][] = [];
  for (let ri = 0; ri < rowVals.length; ri++) {
    for (let ci = 0; ci < colVals.length; ci++) {
      const cell = cellMap.get(`${rowVals[ri]}|${colVals[ci]}`);
      if (mode === 'delta') {
        data.push([ci, ri, cell?.delta ?? null]);
      } else {
        data.push([ci, ri, cell?.value ?? null]);
      }
    }
  }

  const validVals = data.map((d) => d[2]).filter((v): v is number => v != null);
  const maxAbsVal = Math.max(...validVals.map(Math.abs), 1);
  const minVal = mode === 'delta' ? -maxAbsVal : 0;
  const maxVal = maxAbsVal;

  // 颜色范围：绝对值用 surface2 → 方向色；环比用绿←→红发散
  const colorRange =
    mode === 'delta'
      ? direction === 'lower_better'
        ? [COLOR.success, COLOR.surface3, COLOR.danger]   // 负值（降）=改善=绿
        : [COLOR.danger, COLOR.surface3, COLOR.success]   // 负值（降）=恶化=红
      : direction === 'lower_better'
      ? [COLOR.success + '55', COLOR.surface3, COLOR.danger]  // 低值好=绿，高值坏=红
      : [COLOR.danger + '55', COLOR.surface3, COLOR.success]; // 低值坏=红，高值好=绿

  const base = makeBaseOption();

  const option = {
    ...base,
    grid: { top: 16, bottom: 40, left: 16, right: 16, containLabel: true },
    tooltip: {
      ...base.tooltip,
      trigger: 'item',
      formatter: (params: any) => {
        const [ci, ri, val] = params.value;
        const row = rowVals[ri];
        const col = colVals[ci];
        const cell = cellMap.get(`${row}|${col}`);
        if (!cell) return `${row} × ${col}<br/>—`;
        const deltaStr =
          cell.delta != null
            ? `<br/>环比 ${cell.delta > 0 ? '+' : ''}${cell.delta}`
            : '';
        return `${row} × ${col}<br/>${metricName}: <b>${cell.value}</b>${deltaStr}`;
      },
    },
    visualMap: {
      min: minVal,
      max: maxVal,
      show: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 4,
      itemWidth: 12,
      itemHeight: 80,
      textStyle: { color: COLOR.inkSubtle, fontSize: 11, fontFamily: FONT.mono },
      inRange: { color: colorRange },
    },
    xAxis: {
      type: 'category',
      data: colVals,
      position: 'top',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: COLOR.inkSubtle, fontSize: 12, fontFamily: FONT.sans },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'category',
      data: rowVals,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: COLOR.inkMuted, fontSize: 12, fontFamily: FONT.sans },
      splitLine: { show: false },
    },
    series: [
      {
        type: 'heatmap',
        data,
        label: {
          show: true,
          fontFamily: FONT.mono,
          fontSize: 13,
          fontWeight: 600,
          color: COLOR.ink,
          formatter: (params: any) => {
            const val = params.value[2];
            if (val == null) return '—';
            if (mode === 'delta' && val > 0) return `+${val}`;
            return String(val);
          },
        },
        itemStyle: {
          borderWidth: 3,
          borderColor: COLOR.canvas,
          borderRadius: 4,
        },
        emphasis: {
          itemStyle: {
            borderWidth: 3,
            borderColor: COLOR.primary,
          },
        },
      },
    ],
  };

  const cellH = 52;
  const height = Math.max(180, rowVals.length * cellH + 80);

  return (
    <div>
      {hasDelta && (
        <div style={{ display: 'flex', gap: SPACE.xs, marginBottom: SPACE.sm }}>
          {(['value', 'delta'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: '4px 12px',
                borderRadius: 9999,
                border: `1px solid ${mode === m ? COLOR.primary : COLOR.hairline}`,
                background: mode === m ? `${COLOR.primary}22` : 'transparent',
                color: mode === m ? COLOR.primary : COLOR.inkSubtle,
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: FONT.sans,
              }}
            >
              {m === 'value' ? '本期值' : '环比变化'}
            </button>
          ))}
        </div>
      )}
      <ReactECharts option={option} style={{ height }} notMerge lazyUpdate />
    </div>
  );
}
