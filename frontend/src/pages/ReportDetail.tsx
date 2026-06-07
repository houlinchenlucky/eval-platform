import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Space, Spin, App, Collapse, Row, Col, Popconfirm } from 'antd';
import { ArrowLeftOutlined, FilePdfOutlined, DeleteOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import type { ReportDetail, MetricWithTrend } from '../types';
import { COLOR, FONT, SPACE } from '../theme/tokens';
import StatCard from '../components/StatCard';
import GroupBarChart from '../components/GroupBarChart';

// ── status-badge：遵循设计规范 §9 ────────────────────────────────────────────

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 10px',
      borderRadius: 9999,
      background: COLOR.surface2,
      border: `1px solid ${COLOR.hairline}`,
      color: COLOR.inkMuted,
      fontSize: 12,
      fontFamily: FONT.sans,
    }}>
      {children}
    </span>
  );
}

// ── 整体指标：StatCard 大数字 ─────────────────────────────────────────────────

function HeadlineMetrics({ metrics }: { metrics: MetricWithTrend[] }) {
  return (
    <Row gutter={[SPACE.md, SPACE.md]} style={{ marginBottom: SPACE.md }}>
      {metrics.map((m) => {
        const neutral = m.delta == null || m.delta === 0;
        const improved = m.delta != null &&
          (m.direction === 'lower_better' ? m.delta < 0 : m.delta > 0);
        const trendColor = neutral ? COLOR.inkSubtle : improved ? COLOR.success : COLOR.danger;
        const trendText = m.delta != null && m.delta !== 0
          ? `${m.delta > 0 ? '↑' : '↓'}${Math.abs(m.delta)} vs 上期`
          : m.delta === 0 ? '→ 持平' : undefined;
        const prevVal = m.platform_prev_value ?? m.prev_value;
        return (
          <Col key={m.name} xs={24} sm={12} md={8}>
            <StatCard
              label={m.name}
              value={m.value}
              trend={trendText ? { text: trendText, color: trendColor } : undefined}
              hint={prevVal != null ? `上期 ${prevVal}` : undefined}
            />
          </Col>
        );
      })}
    </Row>
  );
}

// ── 普通分组：横条图 ──────────────────────────────────────────────────────────

function GroupSection({ groupName, metrics }: { groupName: string; metrics: MetricWithTrend[] }) {
  return (
    <div style={{
      background: COLOR.surface1,
      border: `1px solid ${COLOR.hairline}`,
      borderRadius: 12,
      marginBottom: SPACE.md,
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
        <span style={{ fontWeight: 500, fontSize: 14, color: COLOR.ink }}>{groupName}</span>
        <span style={{ fontSize: 12, color: COLOR.inkTertiary }}>{metrics.length} 个指标</span>
      </div>
      <div style={{ padding: `${SPACE.sm}px ${SPACE.md}px` }}>
        <GroupBarChart metrics={metrics} />
      </div>
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────────────────────────────────

export default function ReportDetail() {
  const { id } = useParams();
  const rid = Number(id);
  const nav = useNavigate();
  const { message } = App.useApp();

  const [report, setReport] = useState<ReportDetail | null>(null);
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.getReport(rid)
      .then((r) => {
        if (!alive) return;
        setReport(r);
        if (r.has_markdown) {
          api.getMarkdown(rid)
            .then((d) => { if (alive) setMarkdown(d.markdown); })
            .catch(() => void 0);
        }
      })
      .catch(() => message.error('加载报告失败'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [rid]);

  if (loading) return <div style={{ padding: 80, textAlign: 'center' }}><Spin /></div>;
  if (!report) return null;

  const pdfUrl = report.pdf_path ? api.getPdfUrl(rid) : null;
  const headlineGroup = report.groups.find((g) => g.group === '整体指标');
  const otherGroups = report.groups.filter((g) => g.group !== '整体指标');

  return (
    <div>
      {/* 返回按钮 */}
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => nav('/')}
        style={{ marginBottom: SPACE.sm, paddingLeft: 0, color: COLOR.inkSubtle }}
      >
        返回看板
      </Button>

      {/* 顶部信息栏 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: SPACE.lg,
      }}>
        <div>
          <h1 style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: '-0.6px',
            color: COLOR.ink,
          }}>
            {report.name}
          </h1>
          <Space size={SPACE.xs} style={{ marginTop: 8 }}>
            {report.business_tag && <Badge>{report.business_tag}</Badge>}
            <span className="mono" style={{ color: COLOR.inkSubtle, fontSize: 12 }}>
              {report.report_date || '—'} · {report.row_count} 个指标
            </span>
          </Space>
        </div>

        <Space>
          {pdfUrl && (
            <Button icon={<FilePdfOutlined />} href={pdfUrl} target="_blank">
              查看原始 PDF
            </Button>
          )}
          <Button onClick={() => nav('/compare')}>多维回溯</Button>
          <Popconfirm
            title="确认删除该报告？"
            description="删除后无法恢复"
            onConfirm={async () => {
              try {
                await api.deleteReport(rid);
                message.success('已删除');
                nav('/');
              } catch {
                message.error('删除失败');
              }
            }}
            okText="删除" okType="danger" cancelText="取消"
          >
            <Button danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      </div>

      {/* 整体指标：大数字卡片 */}
      {headlineGroup && <HeadlineMetrics metrics={headlineGroup.metrics} />}

      {/* 其他分组：横条图 */}
      {otherGroups.map((g) => (
        <GroupSection key={g.group} groupName={g.group} metrics={g.metrics} />
      ))}

      {report.groups.length === 0 && (
        <div style={{
          background: COLOR.surface1,
          border: `1px solid ${COLOR.hairline}`,
          borderRadius: 12,
          padding: SPACE.xxl,
          textAlign: 'center',
          color: COLOR.inkTertiary,
        }}>
          暂无指标数据
        </div>
      )}

      {/* Markdown 全文（可折叠） */}
      {markdown && (
        <Collapse
          ghost
          style={{ marginTop: SPACE.md }}
          items={[{
            key: 'md',
            label: <span style={{ color: COLOR.inkSubtle, fontSize: 13 }}>报告原文</span>,
            children: (
              <pre style={{
                fontSize: 12,
                color: COLOR.inkMuted,
                maxHeight: 600,
                overflow: 'auto',
                background: COLOR.surface2,
                padding: SPACE.md,
                borderRadius: 8,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}>
                {markdown}
              </pre>
            ),
          }]}
        />
      )}
    </div>
  );
}
