import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { FavoritesStack } from './FavoritesStack';
import { JokesStack } from './JokesStack';
import type { RootTabParamList } from './types';

const Tabs = createBottomTabNavigator<RootTabParamList>();

// Decorative tab glyphs (not translatable copy).
const JOKES_ICON = '🎭';
const FAVORITES_ICON = '♥';

/**
 * Bottom-tab shell: a Dad Jokes tab and a Favorites
 * tab, each hosting its own native stack so a pushed detail keeps the tab bar.
 *
 * `backBehavior="history"` makes Android back walk previously-visited tabs.
 * Tab icons are simple text glyphs for now; the design system can swap
 * in a vector-icon set. Each tab's stack renders its own header, so the tab
 * navigator's header is hidden.
 */
export function AppTabs() {
  const { t } = useTranslation();
  return (
    <Tabs.Navigator backBehavior="history" screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="JokesTab"
        component={JokesStack}
        options={{
          title: t('jokes.title'),
          // Stable selector for the Tier-3 Maestro smoke flows; tapping by tab
          // label is ambiguous because the stack header shows the same text.
          tabBarButtonTestID: 'JokesTab',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>{JOKES_ICON}</Text>,
        }}
      />
      <Tabs.Screen
        name="FavoritesTab"
        component={FavoritesStack}
        options={{
          title: t('favorites.title'),
          tabBarButtonTestID: 'FavoritesTab',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>{FAVORITES_ICON}</Text>,
        }}
      />
    </Tabs.Navigator>
  );
}
