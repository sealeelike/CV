import type { ThemeConfig } from '../types/index.ts';

// Built-in themes bundled with the app
import defaultThemeConfig from '../themes/default/theme.json';
import defaultThemeCSS from '../themes/default/style.css?raw';
import minimalThemeConfig from '../themes/minimal/theme.json';
import minimalThemeCSS from '../themes/minimal/style.css?raw';
const builtinThemes: Record<string, { config: ThemeConfig; css: string }> = {
  default: { config: defaultThemeConfig as ThemeConfig, css: defaultThemeCSS },
  minimal: { config: minimalThemeConfig as ThemeConfig, css: minimalThemeCSS },
};

export interface ResolvedTheme {
  config: ThemeConfig;
  css: string;
}

/**
 * Load a theme by name - checks builtin first, then R2 for custom themes
 */
export async function loadTheme(
  themeName: string,
  r2?: R2Bucket
): Promise<ResolvedTheme> {
  // Check builtin themes
  if (builtinThemes[themeName]) {
    return builtinThemes[themeName];
  }

  // Try loading from R2 (custom themes)
  if (r2) {
    try {
      const [configObj, cssObj] = await Promise.all([
        r2.get(`themes/${themeName}/theme.json`),
        r2.get(`themes/${themeName}/style.css`),
      ]);

      if (configObj && cssObj) {
        const config = JSON.parse(await configObj.text()) as ThemeConfig;
        const css = await cssObj.text();
        return { config, css };
      }
    } catch (err) {
      console.error(`Failed to load custom theme "${themeName}":`, err);
    }
  }

  // Fallback to default
  return builtinThemes['default'];
}
