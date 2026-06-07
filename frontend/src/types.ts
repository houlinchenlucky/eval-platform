// 与后端 API 契约对应的类型定义

export type Direction = 'higher_better' | 'lower_better';

// ── 模板（旧流程保留兼容）────────────────────────────────────────────────────

export interface ColumnMapping {
  date_column: string;
  metric_columns: string[];
  dimension_columns: string[];
  label_column: string | null;
  metric_directions: Record<string, Direction>;
  badcase_metric: string | null;
  problem_column: string | null;
  model_column: string | null;
  scene_column: string | null;
}

export interface Template {
  id: number;
  name: string;
  business_tag: string;
  column_mapping: ColumnMapping;
  created_at: string;
}

// ── 报告列表 ─────────────────────────────────────────────────────────────────

export interface ReportListItem {
  id: number;
  name: string;
  business_tag: string | null;
  report_date: string | null;
  uploaded_at: string;
  row_count: number;
  status: string;
  pdf_path: string | null;
}

export interface ReportListResp {
  total: number;
  items: ReportListItem[];
}

// ── PDF 上传 / AI 抽取 ────────────────────────────────────────────────────────

export interface PdfUploadResp {
  pdf_path: string;
  markdown: string;
}

export interface MetricItem {
  name: string;
  value: number;
  direction: Direction;
  group: string;
  prev_value: number | null;
  cross_row?: string | null;
  cross_col?: string | null;
}

export interface ExtractResp {
  metrics: MetricItem[];
}

// ── 报告详情（带环比） ────────────────────────────────────────────────────────

export interface MetricWithTrend {
  name: string;
  value: number;
  direction: Direction;
  group: string;
  prev_value: number | null;
  platform_prev_value: number | null;
  delta: number | null;
  cross_row?: string | null;
  cross_col?: string | null;
}

export interface MetricGroup {
  group: string;
  metrics: MetricWithTrend[];
}

// ── 交叉表 ───────────────────────────────────────────────────────────────────

export interface CrossCell {
  cross_row: string;
  cross_col: string;
  value: number;
  delta: number | null;
}

export interface CrossGroup {
  group: string;
  metric_name: string;
  direction: Direction;
  row_vals: string[];
  col_vals: string[];
  cells: CrossCell[];
}

export interface CrossCellMulti {
  cross_row: string;
  cross_col: string;
  values: Record<string, number | null>;   // key = report_id as string
  deltas: Record<string, number | null>;
}

export interface CrossTableMulti {
  group: string;
  metric_name: string;
  direction: Direction;
  row_vals: string[];
  col_vals: string[];
  cells: CrossCellMulti[];
}

export interface CrossMatrixResp {
  business_tag: string;
  reports: ReportPeriod[];
  tables: CrossTableMulti[];
}

export interface ReportDetail {
  id: number;
  name: string;
  business_tag: string | null;
  template_id: number | null;
  report_date: string | null;
  uploaded_at: string;
  row_count: number;
  status: string;
  pdf_path: string | null;
  has_markdown: boolean;
  groups: MetricGroup[];
  cross_groups: CrossGroup[];
}

// ── Overview（首页） ──────────────────────────────────────────────────────────

export interface BizLatestCard {
  business_tag: string;
  latest_date: string | null;
  report_id: number | null;
  report_name: string | null;
  report_count: number;
  key_metrics: MetricWithTrend[];
}

export interface OverviewResp {
  biz_cards: BizLatestCard[];
  total_reports: number;
}

// ── 多期矩阵 ─────────────────────────────────────────────────────────────────

export interface ReportPeriod {
  id: number;
  name: string;
  date: string | null;
}

export interface MatrixRow {
  metric: string;
  group: string;
  direction: Direction;
  values: Record<string, number | null>;   // key = report_id as string
  deltas: Record<string, number | null>;
}

export interface MatrixResp {
  business_tag: string;
  reports: ReportPeriod[];
  rows: MatrixRow[];
}

// ── 趋势 ─────────────────────────────────────────────────────────────────────

export interface TrendPoint {
  report_id: number;
  report_name: string;
  report_date: string | null;
  value: number;
}

export interface TrendResp {
  metric: string;
  direction: Direction;
  business_tag: string;
  points: TrendPoint[];
}

// ── 旧对比（保留兼容）────────────────────────────────────────────────────────

export interface UploadResult {
  file_path: string;
  columns: string[];
  preview: Record<string, unknown>[];
}

export interface ChartData {
  categories: string[];
  series: { name: string; data: number[] }[];
}
