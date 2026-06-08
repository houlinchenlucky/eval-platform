import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload as AntUpload, Card, Button, Input, DatePicker, Space,
  Spin, Select, Divider, Table, App, Collapse, Tabs,
} from 'antd';
import { InboxOutlined, CheckOutlined, EditOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import { api } from '../api/client';
import type { MetricItem, Direction } from '../types';
import { COLOR, SPACE, FONT } from '../theme/tokens';

const { Dragger } = AntUpload;

type Step = 'upload' | 'confirm';

// 步骤编号圆圈：active = primary 填充，done = surface-3 + inkSubtle
function StepBadge({ n, active }: { n: number; active: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 22, height: 22, borderRadius: '50%',
      background: active ? COLOR.primary : COLOR.surface3,
      color: active ? '#fff' : COLOR.inkSubtle,
      fontSize: 12, fontWeight: 500, fontFamily: FONT.mono,
      flexShrink: 0,
    }}>
      {n}
    </span>
  );
}

// ── 共用：指标核对表 ──────────────────────────────────────────────────────────

function MetricEditor({
  metrics, onChange,
}: {
  metrics: MetricItem[];
  onChange: (next: MetricItem[]) => void;
}) {
  const update = (idx: number, field: keyof MetricItem, val: any) =>
    onChange(metrics.map((m, i) => i === idx ? { ...m, [field]: val } : m));
  const remove = (idx: number) => onChange(metrics.filter((_, i) => i !== idx));
  const add = () =>
    onChange([...metrics, { name: '', value: 0, direction: 'higher_better' as Direction, group: '整体指标', prev_value: null }]);

  return (
    <>
      <Table
        size="small"
        rowKey={(_, i) => String(i)}
        dataSource={metrics}
        pagination={false}
        scroll={{ x: true }}
        columns={[
          {
            title: '指标名',
            dataIndex: 'name',
            render: (v, _, i) => (
              <Input size="small" value={v}
                onChange={(e) => update(i, 'name', e.target.value)}
                style={{ width: 160 }} />
            ),
          },
          {
            title: '本期值',
            dataIndex: 'value',
            align: 'right',
            render: (v, _, i) => (
              <Input size="small" value={v} type="number"
                onChange={(e) => update(i, 'value', parseFloat(e.target.value) || 0)}
                style={{ width: 90 }} />
            ),
          },
          {
            title: '方向',
            dataIndex: 'direction',
            render: (v, _, i) => (
              <Select size="small" value={v} style={{ width: 120 }}
                onChange={(val) => update(i, 'direction', val as Direction)}
                options={[
                  { label: '越高越好', value: 'higher_better' },
                  { label: '越低越好', value: 'lower_better' },
                ]} />
            ),
          },
          {
            title: '分组',
            dataIndex: 'group',
            render: (v, _, i) => (
              <Input size="small" value={v}
                onChange={(e) => update(i, 'group', e.target.value)}
                style={{ width: 120 }} />
            ),
          },
          {
            title: '上期值（参考）',
            dataIndex: 'prev_value',
            align: 'right',
            render: (v, _, i) => (
              <Input size="small" value={v ?? ''} type="number"
                placeholder="可选"
                onChange={(e) => update(i, 'prev_value', e.target.value ? parseFloat(e.target.value) : null)}
                style={{ width: 90 }} />
            ),
          },
          {
            title: '',
            key: 'del',
            render: (_, __, i) => (
              <Button size="small" type="text" danger onClick={() => remove(i)}>删</Button>
            ),
          },
        ]}
      />
      <Button size="small" type="dashed" onClick={add} style={{ marginTop: SPACE.sm }}>
        + 添加指标
      </Button>
    </>
  );
}

// ── 共用：报告信息表单 ────────────────────────────────────────────────────────

function ReportMeta({
  name, bizTag, reportDate, onChangeName, onChangeBizTag, onChangeDate,
}: {
  name: string; bizTag: string; reportDate: Dayjs | null;
  onChangeName: (v: string) => void;
  onChangeBizTag: (v: string) => void;
  onChangeDate: (v: Dayjs | null) => void;
}) {
  const label: React.CSSProperties = { color: COLOR.inkMuted, fontSize: 12, marginBottom: 6, display: 'block' };
  return (
    <Space size={SPACE.md} wrap style={{ marginBottom: SPACE.lg }}>
      <div>
        <label style={label}>报告名称 *</label>
        <Input style={{ width: 280 }} value={name} onChange={(e) => onChangeName(e.target.value)} />
      </div>
      <div>
        <label style={label}>业务线</label>
        <Input style={{ width: 180 }} value={bizTag} onChange={(e) => onChangeBizTag(e.target.value)} />
      </div>
      <div>
        <label style={label}>报告期次（日期）</label>
        <DatePicker style={{ width: 180 }} value={reportDate} onChange={onChangeDate} placeholder="用于跨期趋势对比" />
      </div>
    </Space>
  );
}

// ── Tab 1：PDF 上传 ───────────────────────────────────────────────────────────

function PdfUploadTab() {
  const nav = useNavigate();
  const { message } = App.useApp();

  const [step, setStep] = useState<Step>('upload');
  const [pdfPath, setPdfPath] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [metrics, setMetrics] = useState<MetricItem[]>([]);
  const [reportName, setReportName] = useState('');
  const [bizTag, setBizTag] = useState('');
  const [reportDate, setReportDate] = useState<Dayjs | null>(null);

  const draggerProps = {
    multiple: false,
    showUploadList: false,
    accept: '.pdf',
    customRequest: async (opt: any) => {
      setUploading(true);
      try {
        const res = await api.uploadPdf(opt.file as File);
        setPdfPath(res.pdf_path);
        setMarkdown(res.markdown);
        const name = (opt.file as File).name.replace(/\.pdf$/i, '');
        setReportName(name);
        opt.onSuccess?.(res);
        // 上传完成后自动调脚本提取，提取结果直接进入核对步骤
        const extracted = await api.extractMetrics(res.markdown, bizTag || undefined);
        setMetrics(extracted.metrics);
        setStep('confirm');
        message.success(
          extracted.metrics.length > 0
            ? `自动提取到 ${extracted.metrics.length} 个指标，请核对后入库`
            : 'PDF 解析完成，请手动填写指标后入库'
        );
      } catch {
        opt.onError?.('上传失败');
        message.error('上传失败，请确认后端已启动');
      } finally {
        setUploading(false);
      }
    },
  };

  const handleConfirm = async () => {
    if (!reportName) { message.warning('请填写报告名称'); return; }
    if (!metrics.length) { message.warning('请至少保留一个指标'); return; }
    setSubmitting(true);
    try {
      const r = await api.confirmReport({
        pdf_path: pdfPath,
        markdown,
        name: reportName,
        business_tag: bizTag || null,
        report_date: reportDate ? reportDate.format('YYYY-MM-DD') : null,
        metrics,
      });
      message.success('入库成功');
      nav(`/report/${r.id}`);
    } catch {
      message.error('入库失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Step 1 */}
      <Card style={{ marginBottom: SPACE.lg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.md }}>
          <StepBadge n={1} active={step === 'upload'} />
          <span style={{ fontWeight: 500, color: COLOR.ink }}>上传 PDF 报告</span>
        </div>
        <Dragger
          {...draggerProps}
          disabled={step !== 'upload' && !uploading}
          style={{
            background: COLOR.surface1,
            borderColor: step === 'upload' ? COLOR.primary : COLOR.hairlineStrong,
            borderRadius: 12,
          }}
        >
          {uploading ? (
            <div style={{ padding: SPACE.lg }}>
              <Spin /><div style={{ color: COLOR.inkMuted, marginTop: SPACE.sm }}>解析中…</div>
            </div>
          ) : (
            <>
              <p><InboxOutlined style={{ fontSize: 40, color: step === 'upload' ? COLOR.primary : COLOR.inkTertiary }} /></p>
              <p style={{ color: step === 'upload' ? COLOR.ink : COLOR.inkTertiary, marginTop: SPACE.sm }}>
                {step === 'upload' ? '点击或拖拽 PDF 评测报告到此处' : `✓ ${reportName}.pdf`}
              </p>
              <p style={{ color: COLOR.inkSubtle, fontSize: 12 }}>自动转 Markdown，支持图文混排报告</p>
            </>
          )}
        </Dragger>
      </Card>

      {/* Step 2 */}
      {step === 'confirm' && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.md }}>
            <StepBadge n={3} active={true} />
            <span style={{ fontWeight: 500, color: COLOR.ink }}>核对指标 · 确认入库</span>
          </div>
          <ReportMeta
            name={reportName} bizTag={bizTag} reportDate={reportDate}
            onChangeName={setReportName} onChangeBizTag={setBizTag} onChangeDate={setReportDate}
          />
          <MetricEditor metrics={metrics} onChange={setMetrics} />
          <Divider />
          <Space>
            <Button type="primary" icon={<CheckOutlined />} loading={submitting} onClick={handleConfirm}>确认入库</Button>
            <Button onClick={() => nav('/')}>取消</Button>
          </Space>
        </Card>
      )}
    </div>
  );
}

// ── Tab 2：手动录入 ───────────────────────────────────────────────────────────

function ManualEntryTab() {
  const nav = useNavigate();
  const { message } = App.useApp();

  const [metrics, setMetrics] = useState<MetricItem[]>([
    { name: '', value: 0, direction: 'higher_better', group: '整体指标', prev_value: null },
  ]);
  const [reportName, setReportName] = useState('');
  const [bizTag, setBizTag] = useState('');
  const [reportDate, setReportDate] = useState<Dayjs | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reportName) { message.warning('请填写报告名称'); return; }
    const valid = metrics.filter((m) => m.name.trim());
    if (!valid.length) { message.warning('请至少填写一条指标名称'); return; }
    setSubmitting(true);
    try {
      const r = await api.confirmReport({
        name: reportName,
        business_tag: bizTag || null,
        report_date: reportDate ? reportDate.format('YYYY-MM-DD') : null,
        metrics: valid,
      });
      message.success('录入成功');
      nav(`/report/${r.id}`);
    } catch {
      message.error('录入失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <div style={{ color: COLOR.inkSubtle, fontSize: 13, marginBottom: SPACE.lg, padding: `${SPACE.sm}px`, background: COLOR.surface2, borderRadius: 8 }}>
        适用于补录历史数据或无 PDF 的评测结论。直接填写指标名称与数值，点击入库后可在趋势图中对比。
      </div>
      <ReportMeta
        name={reportName} bizTag={bizTag} reportDate={reportDate}
        onChangeName={setReportName} onChangeBizTag={setBizTag} onChangeDate={setReportDate}
      />
      <MetricEditor metrics={metrics} onChange={setMetrics} />
      <Divider />
      <Space>
        <Button type="primary" icon={<CheckOutlined />} loading={submitting} onClick={handleSubmit}>确认入库</Button>
        <Button onClick={() => nav('/')}>取消</Button>
      </Space>
    </Card>
  );
}

// ── 页面入口 ─────────────────────────────────────────────────────────────────

export default function Upload() {
  return (
    <div>
      <h1 style={{ margin: `0 0 ${SPACE.lg}px`, fontSize: 32, fontWeight: 600, letterSpacing: '-1px', color: COLOR.ink }}>
        上传 / 录入报告
      </h1>
      <Tabs
        defaultActiveKey="pdf"
        items={[
          {
            key: 'pdf',
            label: (
              <Space><InboxOutlined />PDF 上传（AI 识别）</Space>
            ),
            children: <PdfUploadTab />,
          },
          {
            key: 'manual',
            label: (
              <Space><EditOutlined />手动录入</Space>
            ),
            children: <ManualEntryTab />,
          },
        ]}
      />
    </div>
  );
}
