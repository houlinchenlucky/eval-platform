import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import { DashboardOutlined, CloudUploadOutlined, SwapOutlined } from '@ant-design/icons';
import { CompareProvider } from './contexts/CompareContext';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import ReportDetail from './pages/ReportDetail';
import Compare from './pages/Compare';
import { COLOR, SPACE } from './theme/tokens';

const { Header, Content } = Layout;

function TopNav() {
  const nav = useNavigate();
  const loc = useLocation();

  const selectedKey = loc.pathname.startsWith('/upload')
    ? '/upload'
    : loc.pathname.startsWith('/compare')
      ? '/compare'
      : '/';

  return (
    <Header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        height: 56,
        display: 'flex',
        alignItems: 'center',
        borderBottom: `1px solid ${COLOR.hairline}`,
        paddingInline: SPACE.lg,
      }}
    >
      <div
        style={{
          fontWeight: 600,
          fontSize: 15,
          letterSpacing: 0,
          color: COLOR.ink,
          marginRight: SPACE.xl,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ color: COLOR.primary }}>●</span> 评测指标看板
      </div>
      <Menu
        mode="horizontal"
        selectedKeys={[selectedKey]}
        onClick={(e) => nav(e.key)}
        style={{ flex: 1, background: 'transparent', borderBottom: 'none' }}
        items={[
          { key: '/', icon: <DashboardOutlined />, label: '评测看板' },
          { key: '/upload', icon: <CloudUploadOutlined />, label: '上传报告' },
          { key: '/compare', icon: <SwapOutlined />, label: '指标趋势' },
        ]}
      />
    </Header>
  );
}

export default function App() {
  return (
    <CompareProvider>
      <Layout style={{ minHeight: '100%' }}>
        <TopNav />
        <Content
          style={{
            maxWidth: 1280,
            width: '100%',
            margin: '0 auto',
            padding: SPACE.lg,
          }}
        >
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/report/:id" element={<ReportDetail />} />
            <Route path="/compare" element={<Compare />} />
          </Routes>
        </Content>
      </Layout>
    </CompareProvider>
  );
}
