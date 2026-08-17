import type { TextStyle } from 'react-native';

/**
 * Design tokens — the single source of truth for colors, spacing, radii, and
 * typography. Screens and components read these through `useTheme()`; no screen
 * hardcodes a color or a magic number.
 *
 * The color roles cover the brand's light and dark `ColorScheme`s, plus the few
 * extra roles a React Native surface needs (`background`, muted text, `border`,
 * `favorite`).
 */
export interface ColorTokens {
  /** Brand color for primary actions, active tabs, links. */
  readonly primary: string;
  /** Foreground on top of `primary` (button labels). */
  readonly onPrimary: string;
  /** Secondary/brand accent. */
  readonly secondary: string;
  /** Foreground on top of `secondary`. */
  readonly onSecondary: string;
  /** Error/danger color (also the favorite heart in light mode). */
  readonly error: string;
  /** Foreground on top of `error`. */
  readonly onError: string;
  /** Warning/caution color (e.g. the warn level in the diagnostics log console). */
  readonly warning: string;
  /** App/screen background (behind cards). */
  readonly background: string;
  /** Elevated surface (cards, headers). */
  readonly surface: string;
  /** Primary text/icon color on `background`/`surface`. */
  readonly onSurface: string;
  /** Secondary/subdued text. */
  readonly onSurfaceMuted: string;
  /** Hairline borders/dividers. */
  readonly border: string;
  /** Filled-favorite accent. */
  readonly favorite: string;
}

export const lightColors: ColorTokens = {
  primary: '#0D59CD',
  onPrimary: '#FFFFFF',
  secondary: '#5BC5F2',
  onSecondary: '#001E60',
  error: '#D93B27',
  onError: '#FDEFED',
  warning: '#9A6700',
  background: '#EAF1FB',
  surface: '#F5FAFF',
  onSurface: '#001E60',
  onSurfaceMuted: '#4A5A7A',
  border: '#D5E3F7',
  favorite: '#D93B27',
};

export const darkColors: ColorTokens = {
  primary: '#89C5FF',
  onPrimary: '#121821',
  secondary: '#FCA58B',
  onSecondary: '#302B29',
  error: '#E8897D',
  onError: '#32110D',
  warning: '#E3B341',
  background: '#1E2226',
  surface: '#2C3034',
  onSurface: '#FFFFFF',
  onSurfaceMuted: '#B7BDC6',
  border: '#3A4046',
  favorite: '#FCA58B',
};

/** 4-pt spacing scale — use these instead of literal margins/paddings. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Corner radii. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;

/** Text variants (size + weight); color is applied separately from `colors`. */
export const typography = {
  title: { fontSize: 22, fontWeight: '700' },
  heading: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400' },
  subtitle: { fontSize: 14, fontWeight: '400' },
  caption: { fontSize: 12, fontWeight: '400' },
  button: { fontSize: 16, fontWeight: '600' },
} as const satisfies Record<string, TextStyle>;

export type Spacing = typeof spacing;
export type Radius = typeof radius;
export type Typography = typeof typography;
export type TypographyVariant = keyof Typography;
