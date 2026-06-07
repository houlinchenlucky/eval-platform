import { useEffect, useState, useMemo } from 'react';
import { Card, Select, Space, Empty, Spin, App, Segmented, Checkbox, Table, Row, Col } from 'antd';
import type { ColumnType } from 'antd/es/table';
import TrendLineChart from '../components/TrendLineChart';
import CrossHeatmap from '../components/CrossHeatmap';
import { api } from '../api/client';
import type {
  BizLatestCard, MatrixResp, MatrixRow, Direction,
  CrossMatrixResp, ReportPeriod,
} from '../types';
import { COLOR, SPACE, FONT, CHART_PALETTE } from '../theme/tokens';

// ── 工具组件 ──────────────────────────────────────────────────────────────────

function DeltaCell({ val, delta, direction }: {
  val: number | null; delta: number | null; direction: Direction;
}) {
  if (val == null) return <span style={{ color: COLOR.inkTertiary }}>—</span>;
  const improved = delta == null ? null
    : (direction === 'lower_better' ? delta < 0 : delta > 0);
  const color = delta == null || delta === 0 ? COLOR.ink
    : improved ? COLOR.success : COLOR.danger;
  const arrow = delta == null ? '' : delta > 0 ? ' ↑' : delta < 0 ? ' ↓' : '';
  const abs = delta != null ? Math.abs(delta) : null;
  return (
    <div style={{ textAlign: 'right' }}>
      <span className="mono" style={{ fontWeight: 600, color }}>{val}</span>
      {abs != null && (
        <span className="mono" style={{ fontSize: 11, color, marginLeft: 4 }}>
          {arrow}{abs}
        </span>
      )}
    </div>
  );
}

function GroupBadge({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      padding: '1px 8px',
      borderRadius: 9999,
      background: COLOR.surface2,
      border: `1px solid ${COLOR.hairline}`,
      color: COLOR.inkSubtle,
      fontSize: 11,
      fontFamily: FONT.sans,
      marginRight: 6,
    }}>
      {label}
    </span>
  );
}

// ── 左侧报告列表项 ─────────────────────────────────────────────────────────────
// 设计规范 §11.4：选中项 surface-2 + 左 2px primary 竖条

function ReportItem({
  report, selected, onClick,
}: { report: ReportPeriod; selected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: `${SPACE.sm}px ${SPACE.md}px`,
        borderLeft: `2px solid ${selected ? COLOR.primary : 'transparent'}`,
        background: selected ? COLOR.surface2 : 'transparent',
        cursor: 'pointer',
        transition: 'background 0.12s',
        borderBottom: `1px solid ${COLOR.hairlineTertiary}`,
      }}
      onMouseEnter={(e) => {
        if (!selected) (e.currentTarget as HTMLDivElement).style.background = `${COLOR.surface2}88`;
      }}
      onMouseLeave={(e) => {
        if (!selected) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
      }}
    >
      <div style={{
        fontSize: 13,
        color: selected ? COLOR.ink : COLOR.inkMuted,
        fontWeight: selected ? 500 : 400,
        lineHeight: 1.4,
        marginBottom: 2,
      }}>
        {report.name}
      </div>
      {report.date && (
        <div className="mono" style={{ fontSize: 11, color: COLOR.inkTertiary }}>
          {report.date}
        </div>
      )}
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────────────────────────────────

type View = '横向对比表' | '多指标趋势' | '结构变化' | '交叉热力图';

export default function Compare() {
  const { message } = App.useApp();

  const [overview, setOverview] = useState<BizLatestCard[]>([]);
  const [bizTag, setBizTag] = useState<string>();
  const [matrix, setMatrix] = useState<MatrixResp | null>(null);
  const [crossMatrix, setCrossMatrix] = useState<CrossMatrixResp | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [view, setView] = useState<View>('横向对比表');

  // 选中的报告 ID（空 = 全选）
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [checkedMetrics, setCheckedMetrics] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>();
  const [selectedCrossTable, setSelectedCrossTable] = useState<string>();
  const [selectedCrossPeriod, setSelectedCrossPeriod] = useState<number>();

  useEffect(() => {
    api.getOverview()
      .then((r) => {
        setOverview(r.biz_cards);
        if (r.biz_cards.length > 0) setBizTag(r.biz_cards[0].business_tag);
      })
      .catch(() => message.error('加载失败'))
      .finally(() => setLoadingOverview(false));
  }, []);

  useEffect(() => {
    if (!bizTag) return;
    setMatrix(null);
    setCrossMatrix(null);
    setSelectedIds(new Set());
    setCheckedMetrics([]);
    setSelectedGroup(undefined);
    setSelectedCrossTable(undefined);
    setSelectedCrossPeriod(undefined);
    setLoadingMatrix(true);

    Promise.all([api.getMatrix(bizTag), api.getCrossMatrix(bizTag)])
      .then(([m, cm]) => {
        setMatrix(m);
        setCrossMatrix(cm);
        const defaults = m.rows.filter((r) => r.group === '整体指标').map((r) => r.metric);
        setCheckedMetrics(defaults.length > 0 ? defaults : m.rows.slice(0, 3).map((r) => r.metric));
        const groups = Array.from(new Set(m.rows.map((r) => r.group)));
        setSelectedGroup(groups[0]);
        if (cm.tables.length > 0) setSelectedCrossTable(cm.tables[0].group);
        if (m.reports.length > 0) setSelectedCrossPeriod(m.reports[m.reports.length - 1].id);
      })
      .catch(() => message.error('加载数据失败'))
      .finally(() => setLoadingMatrix(false));
  }, [bizTag]);

  // 选中的期次列表（空 = 全选）
  const visibleReports = useMemo(() => {
    if (!matrix) return [];
    return selectedIds.size === 0
      ? matrix.reports
      : matrix.reports.filter((r) => selectedIds.has(r.id));
  }, [matrix, selectedIds]);

  function toggleReport(id: number) {
    setSelectedIds((prev) => {
      const isEffectivelyAll = prev.size === 0;
      const allIds = new Set(matrix?.reports.map((r) => r.id) ?? []);
      const current = isEffectivelyAll ? new Set(allIds) : new Set(prev);
      if (current.has(id)) {
        current.delete(id);
      } else {
        current.add(id);
      }
      // 全部选中时等同于空集（全选）
      if (current.size === allIds.size) return new Set();
      return current;
    });
  }

  const groups = useMemo(() =>
    matrix ? Array.from(new Set(matrix.rows.map((r) => r.group))) : []
  , [matrix]);

  // ── 视图 1：横向对比表 ────────────────────────────────────────────────────

  const matrixColumns = useMemo((): ColumnType<MatrixRow>[] => {
    if (!matrix) return [];
    const cols: ColumnType<MatrixRow>[] = [{
      title: '指标',
      dataIndex: 'metric',
      width: 200,
      fixed: 'left',
      render: (name: string, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <GroupBadge label={row.group} />
          <span style={{ color: COLOR.ink, fontSize: 13 }}>{name}</span>
        </div>
      ),
    }];
    visibleReports.forEach((rep, i) => {
      cols.push({
        title: (
          <div style={{ textAlign: 'right', lineHeight: 1.4 }}>
            <div style={{ color: COLOR.ink, fontSize: 12 }}>{rep.date ?? rep.name}</div>
          </div>
        ),
        key: String(rep.id),
        align: 'right',
        render: (_, row) => {
          const val = row.values[String(rep.id)] ?? null;
          // 根据当前可见列顺序动态算差值，而非后端存储的相邻期差值
          let delta: number | null = null;
          if (i > 0) {
            const prevVal = row.values[String(visibleReports[i - 1].id)] ?? null;
            delta = val != null && prevVal != null
              ? Math.round((val - prevVal) * 10000) / 10000
              : null;
          }
          return <DeltaCell val={val} delta={delta} direction={row.direction} />;
        },
      });
    });
    return cols;
  }, [matrix, visibleReports]);

  // ── 视图 2：多指标趋势 ────────────────────────────────────────────────────

  const trendSeries = useMemo(() => {
    if (!matrix) return { x: [] as string[], series: [] };
    const x = visibleReports.map((r) => r.date ?? r.name);
    const series = checkedMetrics.map((name) => {
      const row = matrix.rows.find((r) => r.metric === name);
      if (!row) return null;
      return { name, data: visibleReports.map((rep) => row.values[String(rep.id)] ?? 0) };
    }).filter(Boolean) as { name: string; data: number[] }[];
    return { x, series };
  }, [matrix, visibleReports, checkedMetrics]);

  // ── 视图 3：结构变化 ──────────────────────────────────────────────────────

  const structSeries = useMemo(() => {
    if (!matrix || !selectedGroup) return { x: [] as string[], series: [] };
    const x = visibleReports.map((r) => r.date ?? r.name);
    return {
      x,
      series: matrix.rows
        .filter((r) => r.group === selectedGroup)
        .map((row) => ({
          name: row.metric,
          data: visibleReports.map((rep) => row.values[String(rep.id)] ?? 0),
        })),
    };
  }, [matrix, visibleReports, selectedGroup]);

  // ── 渲染 ──────────────────────────────────────────────────────────────────

  if (loadingOverview) return <div style={{ textAlign: 'center', padding: 80 }}><Spin /></div>;

  return (
    <div>
      {/* 页头 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACE.lg,
      }}>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 600, letterSpacing: '-1px', color: COLOR.ink }}>
          多维回溯
        </h1>
        <Space>
          <span style={{ color: COLOR.inkSubtle, fontSize: 12 }}>业务线</span>
          <Select
            style={{ width: 200 }}
            value={bizTag}
            onChange={setBizTag}
            options={overview.map((c) => ({ label: c.business_tag, value: c.business_tag }))}
            notFoundContent={<span style={{ color: COLOR.inkSubtle }}>暂无数据</span>}
          />
        </Space>
      </div>

      {overview.length === 0 ? (
        <Card><Empty description="暂无数据，请先上传评测报告" /></Card>
      ) : loadingMatrix ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spin /></div>
      ) : !matrix || matrix.reports.length === 0 ? (
        <Card><Empty description="该业务线暂无报告数据" /></Card>
      ) : (
        <Row gutter={SPACE.lg} align="top">

          {/* ── 左侧报告列表 ── */}
          <Col xs={24} md={5}>
            <div style={{
              background: COLOR.surface1,
              border: `1px solid ${COLOR.hairline}`,
              borderRadius: 12,
              overflow: 'hidden',
              position: 'sticky',
              top: 24,
            }}>
              <div style={{
                padding: `${SPACE.sm}px ${SPACE.md}px`,
                borderBottom: `1px solid ${COLOR.hairline}`,
                background: COLOR.surface2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: COLOR.inkSubtle, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                  报告期次
                </span>
                {selectedIds.size > 0 && (
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    style={{
                      border: 'none', background: 'transparent',
                      color: COLOR.inkTertiary, fontSize: 11,
                      cursor: 'pointer', fontFamily: FONT.sans, padding: 0,
                    }}
                  >
                    全选
                  </button>
                )}
              </div>
              {matrix.reports.map((rep) => (
                <ReportItem
                  key={rep.id}
                  report={rep}
                  selected={selectedIds.size === 0 || selectedIds.has(rep.id)}
                  onClick={() => toggleReport(rep.id)}
                />
              ))}
              <div style={{ padding: `${SPACE.xs}px ${SPACE.md}px`, borderTop: `1px solid ${COLOR.hairlineTertiary}` }}>
                <span style={{ fontSize: 11, color: COLOR.inkTertiary }}>
                  {selectedIds.size === 0 ? '全部' : `${selectedIds.size}`} 期已选
                </span>
              </div>
            </div>
          </Col>

          {/* ── 右侧内容区 ── */}
          <Col xs={24} md={19}>
            <Segmented
              options={['横向对比表', '多指标趋势', '结构变化', '交叉热力图'] as View[]}
              value={view}
              onChange={(v) => setView(v as View)}
              style={{ marginBottom: SPACE.lg }}
            />

            {/* 视图 1：横向对比表 */}
            {view === '横向对比表' && (
              <Card
                title={
                  <span>
                    指标 × 期次矩阵
                    <span style={{ color: COLOR.inkSubtle, fontWeight: 400, fontSize: 12, marginLeft: SPACE.sm }}>
                      {visibleReports.length} 期 · {matrix.rows.length} 个指标
                    </span>
                  </span>
                }
                styles={{ body: { padding: 0 } }}
              >
                <Table
                  size="small"
                  rowKey="metric"
                  dataSource={matrix.rows}
                  columns={matrixColumns}
                  pagination={false}
                  scroll={{ x: true }}
                  onRow={(row) => ({
                    style: { background: row.group === '整体指标' ? COLOR.surface2 : 'transparent' },
                  })}
                />
              </Card>
            )}

            {/* 视图 2：多指标趋势 */}
            {view === '多指标趋势' && (
              <Row gutter={SPACE.md}>
                <Col xs={24} md={7}>
                  <Card title="选择指标" styles={{ body: { padding: SPACE.sm } }}>
                    {groups.map((grp) => (
                      <div key={grp} style={{ marginBottom: SPACE.sm }}>
                        <div style={{ color: COLOR.inkSubtle, fontSize: 11, marginBottom: 4 }}>{grp}</div>
                        <Space direction="vertical" size={4}>
                          {matrix.rows.filter((r) => r.group === grp).map((row) => {
                            const colorIdx = matrix.rows.indexOf(row) % CHART_PALETTE.length;
                            return (
                              <Checkbox
                                key={row.metric}
                                checked={checkedMetrics.includes(row.metric)}
                                onChange={(e) => {
                                  setCheckedMetrics((p) =>
                                    e.target.checked ? [...p, row.metric] : p.filter((m) => m !== row.metric)
                                  );
                                }}
                              >
                                <span style={{ fontSize: 12, color: COLOR.inkMuted }}>
                                  <span style={{
                                    display: 'inline-block', width: 8, height: 8,
                                    borderRadius: 2, background: CHART_PALETTE[colorIdx], marginRight: 5,
                                  }} />
                                  {row.metric}
                                  <span style={{ color: COLOR.inkTertiary, fontSize: 10, marginLeft: 4 }}>
                                    {row.direction === 'higher_better' ? '↑好' : '↓好'}
                                  </span>
                                </span>
                              </Checkbox>
                            );
                          })}
                        </Space>
                      </div>
                    ))}
                  </Card>
                </Col>
                <Col xs={24} md={17}>
                  <Card
                    title={`${checkedMetrics.length} 个指标趋势`}
                    styles={{ body: { padding: SPACE.md } }}
                  >
                    {checkedMetrics.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: SPACE.xl, color: COLOR.inkTertiary }}>
                        从左侧勾选指标
                      </div>
                    ) : (
                      <TrendLineChart x={trendSeries.x} series={trendSeries.series} height={400} />
                    )}
                  </Card>
                </Col>
              </Row>
            )}

            {/* 视图 3：结构变化 */}
            {view === '结构变化' && (
              <Card
                title={
                  <Space>
                    <span>分组内结构变化</span>
                    <Select
                      size="small"
                      style={{ width: 160 }}
                      value={selectedGroup}
                      onChange={setSelectedGroup}
                      options={groups.map((g) => ({ label: g, value: g }))}
                    />
                  </Space>
                }
                styles={{ body: { padding: SPACE.md } }}
              >
                {structSeries.series.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: SPACE.xl, color: COLOR.inkTertiary }}>暂无数据</div>
                ) : (
                  <>
                    <TrendLineChart x={structSeries.x} series={structSeries.series} height={360} />
                    <div style={{ marginTop: SPACE.md, display: 'flex', flexWrap: 'wrap', gap: SPACE.sm }}>
                      {matrix.rows.filter((r) => r.group === selectedGroup).map((row) => {
                        const last = visibleReports[visibleReports.length - 1];
                        const prev = visibleReports[visibleReports.length - 2];
                        const lastVal = last ? (row.values[String(last.id)] ?? null) : null;
                        const prevVal = prev ? (row.values[String(prev.id)] ?? null) : null;
                        const delta = lastVal != null && prevVal != null
                          ? Math.round((lastVal - prevVal) * 10000) / 10000
                          : null;
                        const improved = delta == null ? null
                          : row.direction === 'lower_better' ? delta < 0 : delta > 0;
                        return (
                          <div key={row.metric} style={{
                            padding: `${SPACE.xs}px ${SPACE.sm}px`,
                            borderRadius: 8,
                            background: COLOR.surface2,
                            borderLeft: `3px solid ${delta == null ? COLOR.hairlineStrong : improved ? COLOR.success : COLOR.danger}`,
                            minWidth: 100,
                          }}>
                            <div style={{ color: COLOR.inkMuted, fontSize: 12 }}>{row.metric}</div>
                            <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: COLOR.ink }}>
                              {lastVal ?? '—'}
                            </div>
                            {delta != null && (
                              <div className="mono" style={{ fontSize: 11, color: improved ? COLOR.success : COLOR.danger }}>
                                {delta > 0 ? '+' : ''}{delta} vs 上期
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </Card>
            )}

            {/* 视图 4：交叉热力图 */}
            {view === '交叉热力图' && (
              !crossMatrix || crossMatrix.tables.length === 0 ? (
                <Card>
                  <Empty description="该业务线暂无交叉表数据（上传含交叉表的报告后自动出现）" />
                </Card>
              ) : (
                <div>
                  {/* 交叉表 + 期次选择 */}
                  <div style={{
                    background: COLOR.surface1,
                    border: `1px solid ${COLOR.hairline}`,
                    borderRadius: 12,
                    padding: `${SPACE.sm}px ${SPACE.lg}px`,
                    marginBottom: SPACE.md,
                    display: 'flex',
                    alignItems: 'center',
                    gap: SPACE.lg,
                    flexWrap: 'wrap',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs }}>
                      <span style={{ fontSize: 12, color: COLOR.inkSubtle }}>交叉表</span>
                      <Select
                        size="small"
                        style={{ width: 180 }}
                        value={selectedCrossTable}
                        onChange={setSelectedCrossTable}
                        options={crossMatrix.tables.map((t) => ({ label: t.group, value: t.group }))}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs }}>
                      <span style={{ fontSize: 12, color: COLOR.inkSubtle }}>期次</span>
                      <Select
                        size="small"
                        style={{ width: 140 }}
                        value={selectedCrossPeriod}
                        onChange={setSelectedCrossPeriod}
                        options={crossMatrix.reports
                          .filter((r) => selectedIds.size === 0 || selectedIds.has(r.id))
                          .map((r) => ({ label: r.date ?? r.name, value: r.id }))}
                      />
                    </div>
                  </div>

                  {/* 热力图主体 */}
                  {(() => {
                    const tbl = crossMatrix.tables.find((t) => t.group === selectedCrossTable);
                    if (!tbl || selectedCrossPeriod == null) return (
                      <Card><Empty description="请选择交叉表和期次" /></Card>
                    );
                    const ridStr = String(selectedCrossPeriod);
                    const prevIdx = crossMatrix.reports.findIndex((r) => r.id === selectedCrossPeriod) - 1;
                    const prevRid = prevIdx >= 0 ? String(crossMatrix.reports[prevIdx].id) : null;
                    const cells = tbl.cells.map((c) => ({
                      cross_row: c.cross_row,
                      cross_col: c.cross_col,
                      value: c.values[ridStr] ?? 0,
                      delta: prevRid != null ? (c.deltas[ridStr] ?? null) : null,
                    }));
                    return (
                      <div style={{
                        background: COLOR.surface1,
                        border: `1px solid ${COLOR.hairline}`,
                        borderRadius: 12,
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          padding: `${SPACE.sm}px ${SPACE.lg}px`,
                          borderBottom: `1px solid ${COLOR.hairline}`,
                          background: COLOR.surface2,
                          display: 'flex',
                          alignItems: 'center',
                          gap: SPACE.sm,
                        }}>
                          <span style={{ fontWeight: 500, fontSize: 14, color: COLOR.ink }}>
                            {tbl.group}
                          </span>
                          <span style={{ fontSize: 12, color: COLOR.inkTertiary }}>
                            {tbl.row_vals.length} 行 × {tbl.col_vals.length} 列 ·{' '}
                            {crossMatrix.reports.find((r) => r.id === selectedCrossPeriod)?.date}
                          </span>
                        </div>
                        <div style={{ padding: SPACE.lg }}>
                          <CrossHeatmap
                            group={tbl.group}
                            metricName={tbl.metric_name}
                            direction={tbl.direction}
                            rowVals={tbl.row_vals}
                            colVals={tbl.col_vals}
                            cells={cells}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )
            )}
          </Col>
        </Row>
      )}
    </div>
  );
}
