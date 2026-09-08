/**
 * MindKNUST Admin Dashboard - Apple HIG Design Tokens
 * 
 * Provides unified theme constants for colors, surfaces, typography,
 * shadows, and Recharts styling to guarantee 100% visual consistency.
 */

export const THEME = {
  surfaces: {
    canvas: '#090C15',
    sidebar: '#0D111C',
    card: '#131926',
    elevated: '#192030',
    inset: '#0A0E18',
    border: 'rgba(255, 255, 255, 0.06)',
    borderHover: 'rgba(255, 255, 255, 0.12)',
    borderActive: 'rgba(108, 83, 248, 0.4)',
  },
  colors: {
    brand: {
      DEFAULT: '#6C53F8',
      hover: '#5B3FE0',
      active: '#4D2FC4',
      subtle: 'rgba(108, 83, 248, 0.12)',
      border: 'rgba(108, 83, 248, 0.25)',
      text: '#9487FF',
    },
    emerald: {
      DEFAULT: '#10B981',
      hover: '#059669',
      subtle: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.25)',
      text: '#34D399',
    },
    amber: {
      DEFAULT: '#F59E0B',
      hover: '#D97706',
      subtle: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.25)',
      text: '#FBBF24',
    },
    rose: {
      DEFAULT: '#EF4444',
      hover: '#DC2626',
      subtle: 'rgba(239, 68, 68, 0.12)',
      border: 'rgba(239, 68, 68, 0.25)',
      text: '#F87171',
    },
    indigo: {
      DEFAULT: '#6366F1',
      hover: '#4F46E5',
      subtle: 'rgba(99, 102, 241, 0.12)',
      border: 'rgba(99, 102, 241, 0.25)',
      text: '#818CF8',
    },
    orange: {
      DEFAULT: '#F97316',
      hover: '#EA580C',
      subtle: 'rgba(249, 115, 22, 0.12)',
      border: 'rgba(249, 115, 22, 0.25)',
      text: '#FB923C',
    },
  },
  charts: {
    gridStroke: 'rgba(255, 255, 255, 0.05)',
    axisStroke: '#64748B',
    fontSize: 11,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    barColor: '#6C53F8',
    lineColor: '#10B981',
  }
} as const;
