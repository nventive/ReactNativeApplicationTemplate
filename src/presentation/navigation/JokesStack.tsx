import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { JokeDetailScreen } from '../jokes/JokeDetailScreen';
import { JokesScreen } from '../jokes/JokesScreen';
import type { JokesStackParamList } from './types';

const Stack = createNativeStackNavigator<JokesStackParamList>();

/**
 * Jokes tab stack: the list, plus a pushed detail screen. Pushing keeps the tab
 * bar visible.
 */
export function JokesStack() {
  const { t } = useTranslation();
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="JokesList"
        component={JokesScreen}
        options={{ title: t('jokes.title') }}
      />
      <Stack.Screen
        name="JokeDetail"
        component={JokeDetailScreen}
        options={{ title: t('jokes.detailTitle') }}
      />
    </Stack.Navigator>
  );
}
