import axios from 'axios';
import type {
  Template, ColumnMapping, UploadResult, ReportListResp,
  ReportDetail, ChartData, ReportListItem, OverviewResp,
  PdfUploadResp, ExtractResp, MetricItem, TrendResp, MatrixResp,
  CrossMatrixResp,
} from '../types';

const http = axios.create({ baseURL: '/api', timeout: 60000 });

export interface CreateTemplateBody {
  name: string;
  business_tag: string;
  column_mapping: ColumnMapping;
}

export interface ConfirmBody {
  pdf_path?: string | null;
  markdown?: string | null;
  name: string;
  business_tag: string | null;
  report_date: string | null;
  metrics: MetricItem[];
}

export const api = {
  // 模板
  listTemplates: () => http.get<Template[]>('/templates').then((r) => r.data),
  createTemplate: (body: CreateTemplateBody) =>
    http.post<Template>('/templates', body).then((r) => r.data),
  getTemplate: (id: number) =>
    http.get<Template>(`/templates/${id}`).then((r) => r.data),

  // PDF 上传流程
  uploadPdf: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return http.post<PdfUploadResp>('/reports/upload-pdf', fd, { timeout: 120000 }).then((r) => r.data);
  },
  extractMetrics: (pdfPath: string, businessTag?: string) =>
    http.post<ExtractResp>('/reports/extract', { pdf_path: pdfPath, business_tag: businessTag }, { timeout: 120000 })
      .then((r) => r.data),
  confirmReport: (body: ConfirmBody) =>
    http.post<ReportListItem>('/reports/confirm', body).then((r) => r.data),

  // 报告列表 / 详情
  listReports: (params: { business_tag?: string; page?: number; limit?: number }) =>
    http.get<ReportListResp>('/reports', { params }).then((r) => r.data),
  getReport: (id: number) =>
    http.get<ReportDetail>(`/reports/${id}`).then((r) => r.data),
  deleteReport: (id: number) =>
    http.delete<{ ok: boolean }>(`/reports/${id}`).then((r) => r.data),
  getMarkdown: (id: number) =>
    http.get<{ markdown: string }>(`/reports/${id}/markdown`).then((r) => r.data),
  getPdfUrl: (id: number) => `/api/reports/${id}/pdf`,

  // Overview / 趋势
  getOverview: () =>
    http.get<OverviewResp>('/reports/overview').then((r) => r.data),
  getTrend: (businessTag: string, metric: string) =>
    http.get<TrendResp>('/reports/trend', { params: { business_tag: businessTag, metric } })
      .then((r) => r.data),
  getMatrix: (businessTag: string) =>
    http.get<MatrixResp>('/reports/matrix', { params: { business_tag: businessTag } })
      .then((r) => r.data),
  getCrossMatrix: (businessTag: string) =>
    http.get<CrossMatrixResp>('/reports/cross-matrix', { params: { business_tag: businessTag } })
      .then((r) => r.data),
};
