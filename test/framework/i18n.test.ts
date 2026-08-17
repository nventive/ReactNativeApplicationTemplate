/**
 * Tier 1 — plain TS. Exercises the i18n instance: English defaults, French
 * switching, interpolation, unsupported-locale fallback, and matching en/fr key sets.
 */
import i18n from '../../src/framework/i18n';
import en from '../../src/framework/i18n/locales/en.json';
import fr from '../../src/framework/i18n/locales/fr.json';

function flattenKeys(object: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(object).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'object' && value !== null
      ? flattenKeys(value as Record<string, unknown>, path)
      : [path];
  });
}

describe('i18n', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('resolves English strings by default', () => {
    expect(i18n.t('jokes.title')).toBe('Dad Jokes');
    expect(i18n.t('favorites.title')).toBe('Favorites');
  });

  it('switches to French', async () => {
    await i18n.changeLanguage('fr');

    expect(i18n.t('jokes.title')).toBe('Blagues de Papa');
    expect(i18n.t('favorites.title')).toBe('Favoris');
  });

  it('interpolates values', () => {
    expect(i18n.t('common.error', { error: 'boom' })).toBe('Error: boom');
  });

  it('falls back to English for an unsupported language', async () => {
    await i18n.changeLanguage('de');

    expect(i18n.t('jokes.title')).toBe('Dad Jokes');
  });

  it('keeps en and fr structurally in sync', () => {
    expect(flattenKeys(fr).sort()).toEqual(flattenKeys(en).sort());
  });
});
