import type { ThemeConfig } from 'antd';

/** 全局主题：与 index.css 中的设计令牌保持一致 */
export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: '#3b82f6',
    colorLink: '#3b82f6',
    colorInfo: '#3b82f6',
    colorSuccess: '#10b981',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorTextBase: '#1e293b',
    colorBgLayout: '#f4f6fb',
    borderRadius: 10,
    borderRadiusLG: 14,
    borderRadiusSM: 8,
    controlHeight: 36,
    fontSize: 14,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif",
    motionDurationMid: '0.26s',
    motionDurationSlow: '0.4s',
    motionEaseOutBack: 'cubic-bezier(0.22, 1, 0.36, 1)',
    boxShadow: '0 6px 18px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.04)',
    boxShadowSecondary: '0 18px 44px rgba(30, 41, 82, 0.14), 0 6px 16px rgba(30, 41, 82, 0.06)',
  },
  components: {
    Card: {
      borderRadiusLG: 14,
      headerFontSize: 15,
      headerBg: 'transparent',
      boxShadowTertiary: '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
    },
    Table: {
      headerBg: 'rgba(248, 250, 252, 0.9)',
      headerColor: '#64748b',
      rowHoverBg: 'transparent',
      cellPaddingBlock: 13,
      borderColor: '#eaeef6',
      headerBorderRadius: 12,
    },
    Layout: {
      headerBg: 'rgba(255,255,255,0.82)',
      bodyBg: 'transparent',
      siderBg: 'transparent',
      headerHeight: 62,
      headerPadding: '0 20px',
    },
    Menu: {
      darkItemBg: 'transparent',
      darkSubMenuItemBg: 'transparent',
      darkItemSelectedBg: 'rgba(59,130,246,0.22)',
      darkItemHoverBg: 'rgba(255,255,255,0.08)',
      itemBorderRadius: 11,
      itemHeight: 44,
      itemMarginInline: 12,
    },
    Modal: {
      borderRadiusLG: 18,
    },
    Button: {
      primaryShadow: '0 6px 16px rgba(59,130,246,0.28)',
      fontWeight: 500,
    },
    Input: {
      activeShadow: '0 0 0 3px rgba(59,130,246,0.14)',
      hoverBorderColor: '#93c5fd',
      activeBorderColor: '#3b82f6',
    },
    Select: {
      optionSelectedBg: 'rgba(59,130,246,0.1)',
    },
    Segmented: {
      itemSelectedBg: '#ffffff',
      trackBg: 'rgba(100,116,139,0.08)',
    },
    Tabs: {
      inkBarColor: '#3b82f6',
    },
    Pagination: {
      borderRadius: 8,
    },
    Tag: {
      borderRadiusSM: 999,
    },
    Progress: {
      defaultColor: '#3b82f6',
    },
    Tooltip: {
      borderRadius: 8,
    },
  },
};

export default appTheme;
