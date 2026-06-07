import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Button, Tag, Space, Spin, App, Table, Divider, Segmented, Popconfirm } from 'antd';
import { CloudUploadOutlined, ArrowRightOutlined, FileTextOutlined, FilePdfOutlined, DeleteOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import type { BizLatestCard, MetricWithTrend, ReportListItem } from '../types';
import { COLOR, SPACE, FONT } from '../theme/tokens';
import StatCard from '../components/StatCard';

function DeltaBadge({ m }: { m: MetricWithTrend }) {
  if (m.delta == null) return null;
  const improved = m.direction === 'lower_better' ? m.delta < 0 : m.delta > 0;
  const neutral = m.delta === 0;
  const color = neutral ? COLOR.inkSubtle : improved ? COLOR.success : COLOR.danger;
  const symbol = m.delta > 0 ? '↑' : m.delta < 0 ? '↓' : '→';
  return (
    <span className="mono" style={{ color, fontSize: 12, marginLeft: 4 }}>
      {symbol}{Math.abs(m.delta)}
    </span>
  );
}

function BizCard({ card, onView }: { card: BizLatestCard; onView: () => void }) {
  return (
    <Card hoverable style={{ height: '100%' }} styles={{ body: { padding: SPACE.lg } }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACE.md }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500, color: COLOR.ink, letterSpacing: '-0.3px' }}>
            {card.business_tag}
          </div>
          <div className="mono" style={{ fontSize: 12, color: COLOR.inkSubtle, marginTop: 4 }}>
            {card.report_count} 份报告 · 最新 {card.latest_date || '—'}
          </div>
        </div>
        <Button type="text" icon={<ArrowRightOutlined />} size="small" onClick={onView} />
      </div>

      {card.key_metrics.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {card.key_metrics.map((m) => (
            <div key={m.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ color: COLOR.inkMuted, fontSize: 13 }}>{m.name}</span>
              <span>
                {/* §9 metric-value：Mono 20px，卡片内适当缩小但仍够突出 */}
                <span style={{
                  fontFamily: FONT.mono,
                  fontSize: 20,
                  fontWeight: 600,
                  color: COLOR.ink,
                }}>
                  {m.value}
                </span>
                <DeltaBadge m={m} />
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: COLOR.inkTertiary, fontSize: 13 }}>暂无整体指标数据</div>
      )}
    </Card>
  );
}

export default function Dashboard() {
  const nav = useNavigate();
  const { message } = App.useApp();
  const [cards, setCards] = useState<BizLatestCard[]>([]);
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [bizFilter, setBizFilter] = useState<string>('全部');

  const loadData = () => {
    setLoading(true);
    return Promise.all([
      api.getOverview(),
      api.listReports({ page: 1, limit: 200 }),
    ])
      .then(([overview, list]) => {
        setCards(overview.biz_cards);
        setTotal(overview.total_reports);
        setReports(list.items);
      })
      .catch(() => message.error('加载失败，请确认后端已启动（:8000）'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleDelete = async (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await api.deleteReport(id);
      message.success('已删除');
      loadData();
    } catch {
      message.error('删除失败');
    }
  };

  if (loading) return <div style={{ padding: 80, textAlign: 'center' }}><Spin /></div>;

  const bizTags = Array.from(new Set(reports.map((r) => r.business_tag).filter(Boolean))) as string[];
  const latestDate = reports[0]?.report_date ?? '—';
  const filteredReports = bizFilter === '全部'
    ? reports
    : reports.filter((r) => r.business_tag === bizFilter);

  return (
    <div>
      {/* 页头 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACE.lg }}>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 600, letterSpacing: '-1px', color: COLOR.ink }}>
          评测看板
        </h1>
        <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => nav('/upload')}>
          上传报告
        </Button>
      </div>

      {total === 0 ? (
        <Card style={{ textAlign: 'center', padding: SPACE.xxl }}>
          <FileTextOutlined style={{ fontSize: 48, color: COLOR.inkTertiary, marginBottom: SPACE.md }} />
          <div style={{ color: COLOR.inkSubtle, marginBottom: SPACE.lg }}>还没有评测报告</div>
          <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => nav('/upload')}>
            上传第一份报告
          </Button>
        </Card>
      ) : (
        <>
          {/* §11.1 顶部 StatCard 行 */}
          <Row gutter={[SPACE.md, SPACE.md]} style={{ marginBottom: SPACE.xl }}>
            <Col xs={12} sm={8}>
              <StatCard label="报告总数" value={total} suffix="份" />
            </Col>
            <Col xs={12} sm={8}>
              <StatCard label="业务线" value={bizTags.length} suffix="条" />
            </Col>
            <Col xs={24} sm={8}>
              <StatCard label="最新期次" value={latestDate} />
            </Col>
          </Row>

          {/* 业务线摘要卡片 */}
          <Row gutter={[SPACE.lg, SPACE.lg]} style={{ marginBottom: SPACE.xl }}>
            {cards.map((card) => (
              <Col key={card.business_tag} xs={24} sm={12} lg={8}>
                <BizCard
                  card={card}
                  onView={() => card.report_id && nav(`/report/${card.report_id}`)}
                />
              </Col>
            ))}
          </Row>

          {/* §11.1 业务线 tab pill 筛选 + 报告列表 */}
          <Divider style={{ margin: `0 0 ${SPACE.md}px` }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACE.md }}>
            {/* §9 tab pill 行 */}
            <Segmented
              options={['全部', ...bizTags]}
              value={bizFilter}
              onChange={(v) => setBizFilter(v as string)}
            />
            <Button size="small" onClick={() => nav('/compare')} style={{ color: COLOR.inkMuted }}>
              多维回溯对比 →
            </Button>
          </div>

          <Table
            size="small"
            rowKey="id"
            dataSource={filteredReports}
            pagination={{ pageSize: 20, hideOnSinglePage: true }}
            onRow={(r) => ({ onClick: () => nav(`/report/${r.id}`), style: { cursor: 'pointer' } })}
            columns={[
              {
                title: '报告名称',
                dataIndex: 'name',
                render: (name, r) => (
                  <Space>
                    {r.pdf_path && <FilePdfOutlined style={{ color: COLOR.danger, fontSize: 12 }} />}
                    <span style={{ color: COLOR.ink }}>{name}</span>
                  </Space>
                ),
              },
              {
                title: '业务线',
                dataIndex: 'business_tag',
                render: (v) => v ? <Tag>{v}</Tag> : <span style={{ color: COLOR.inkTertiary }}>—</span>,
              },
              {
                title: '期次',
                dataIndex: 'report_date',
                align: 'center',
                render: (v) => <span className="mono" style={{ color: COLOR.inkSubtle }}>{v || '—'}</span>,
                sorter: (a, b) => (a.report_date ?? '').localeCompare(b.report_date ?? ''),
                defaultSortOrder: 'descend',
              },
              {
                title: '指标数',
                dataIndex: 'row_count',
                align: 'right',
                render: (v) => <span className="mono">{v}</span>,
              },
              {
                title: '',
                key: 'action',
                align: 'right',
                render: (_, r) => (
                  <Space size={4} onClick={(e) => e.stopPropagation()}>
                    <Button type="text" size="small" icon={<ArrowRightOutlined />}
                      onClick={() => nav(`/report/${r.id}`)} />
                    <Popconfirm
                      title="确认删除该报告？"
                      description="删除后无法恢复"
                      onConfirm={(e) => handleDelete(r.id, e as any)}
                      okText="删除" okType="danger" cancelText="取消"
                    >
                      <Button type="text" size="small" icon={<DeleteOutlined />}
                        style={{ color: COLOR.inkTertiary }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = COLOR.danger)}
                        onMouseLeave={(e) => (e.currentTarget.style.color = COLOR.inkTertiary)}
                      />
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
