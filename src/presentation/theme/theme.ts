import {
  darkColors,
  lightColors,
  radius,
  spacing,
  typography,
  type ColorTokens,
  type Radius,
  type Spacing,
  type Typography,
} from './tokens';

/**
 * A resolved theme: the token sets plus whether it is the dark variant. This is
 * the value `useTheme()` returns and every themed component consumes.
 */
export interface Theme {
  readonly dark: boolean;
  readonly colors: ColorTokens;
  readonly spacing: Spacing;
  readonly radius: Radius;
  readonly typography: Typography;
}

export const lightTheme: Theme = {
  dark: false,
  colors: lightColors,
  spacing,
  radius,
  typography,
};

export const darkTheme: Theme = {
  dark: true,
  colors: darkColors,
  spacing,
  radius,
  typography,
};
