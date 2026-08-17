import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { FavoritesScreen } from '../jokes/FavoritesScreen';
import type { FavoritesStackParamList } from './types';

const Stack = createNativeStackNavigator<FavoritesStackParamList>();

/** Favorites tab stack. */
export function FavoritesStack() {
  const { t } = useTranslation();
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="FavoritesList"
        component={FavoritesScreen}
        options={{ title: t('favorites.title') }}
      />
    </Stack.Navigator>
  );
}
