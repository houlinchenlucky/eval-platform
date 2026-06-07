// 设计 token 唯一来源 —— 严格对应「设计规范.md」
// 任何颜色/间距/圆角/字体都从这里取，不要在组件里写死十六进制。

export const COLOR = {
  // 表面（暗色画布 + 四级阶梯）
  canvas: '#010102',
  surface1: '#0e0f12',
  surface2: '#16171b',
  surface3: '#1c1d22',
  surface4: '#23252a',
  hairline: '#23252a',
  hairlineStrong: '#2e3036',
  hairlineTertiary: '#1a1b1f',
  // 文字
  ink: '#f7f8f8',
  inkMuted: '#d0d6e0',
  inkSubtle: '#8a8f98',
  inkTertiary: '#62666d',
  // 品牌强调（单一 lavender）
  primary: '#5e6ad2',
  primaryHover: '#828fff',
  primaryFocus: '#5e69d1',
  onPrimary: '#ffffff',
  // 语义
  success: '#27a644',
  warning: '#e2a336',
  danger: '#e5484d',
  info: '#5e6ad2',
} as const;

// 图表多指标序列色（暗背景高可辨，按顺序分配给第 1、2、3… 个指标）
export const CHART_PALETTE = [
  '#5e6ad2', // lavender
  '#26b5a8', // teal
  '#e2a336', // amber
  '#e5556f', // rose
  '#9b7bf0', // violet
  '#3fb950', // green
  '#4aa3ff', // sky
  '#f0883e', // coral
] as const;

export const FONT = {
  sans: 'Inter, -apple-system, system-ui, "Segoe UI", Roboto, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
} as const;

export const RADIUS = { xs: 4, sm: 6, md: 8, lg: 12, xl: 16 } as const;

export const SPACE = {
  xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48, section: 64,
} as const;
