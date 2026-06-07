import { theme, type ThemeConfig } from 'antd';
import { COLOR, FONT, RADIUS } from './tokens';

// 对应「设计规范.md」§10 —— Ant Design 5 暗色主题映射
export const antdTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: COLOR.primary,
    colorInfo: COLOR.info,
    colorSuccess: COLOR.success,
    colorWarning: COLOR.warning,
    colorError: COLOR.danger,

    colorBgBase: COLOR.canvas,
    colorBgContainer: COLOR.surface1,
    colorBgElevated: COLOR.surface3,
    colorBorder: COLOR.hairline,
    colorBorderSecondary: COLOR.hairlineTertiary,

    colorText: COLOR.ink,
    colorTextSecondary: COLOR.inkMuted,
    colorTextTertiary: COLOR.inkSubtle,
    colorTextQuaternary: COLOR.inkTertiary,

    fontFamily: FONT.sans,
    fontFamilyCode: FONT.mono,
    fontSize: 14,

    borderRadius: RADIUS.md,
    borderRadiusLG: RADIUS.lg,

    controlHeight: 36,
    wireframe: false,
  },
  components: {
    Card: { borderRadiusLG: RADIUS.lg, paddingLG: 24, boxShadow: 'none', boxShadowTertiary: 'none' },
    Button: { borderRadius: RADIUS.md, controlHeight: 36, fontWeight: 500 },
    Table: {
      headerBg: COLOR.surface2,
      headerColor: COLOR.inkSubtle,
      rowHoverBg: COLOR.surface2,
      borderColor: COLOR.hairlineTertiary,
    },
    Tabs: { itemSelectedColor: COLOR.ink },
    Segmented: {
      itemSelectedBg: COLOR.surface2,
      itemSelectedColor: COLOR.ink,
      itemColor: COLOR.inkSubtle,
      trackBg: COLOR.surface1,
    },
    Layout: {
      headerBg: COLOR.canvas,
      bodyBg: COLOR.canvas,
      siderBg: COLOR.canvas,
    },
    Menu: {
      itemBg: 'transparent',
      itemSelectedBg: COLOR.surface2,
      itemSelectedColor: COLOR.ink,
    },
  },
};
