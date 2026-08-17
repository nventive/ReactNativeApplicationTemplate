import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { FeedbackFormScreen } from '../forms/FeedbackFormScreen';
import { AppTabs } from './AppTabs';
import { ExampleModalScreen } from './ExampleModalScreen';
import type { RootStackParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();

/**
 * The root native-stack: the bottom-tab shell, plus a demo modal presented over
 * it. The forced-update and kill-switch blocking screens are intentionally
 * *not* routes here — they block the whole app from outside the navigator via
 * `AppGate` (see `doc/ForcedUpdate.md`), replacing the shell entirely.
 */
export function RootNavigator() {
  const { t } = useTranslation();
  return (
    <RootStack.Navigator>
      <RootStack.Screen name="Tabs" component={AppTabs} options={{ headerShown: false }} />
      <RootStack.Group screenOptions={{ presentation: 'modal' }}>
        <RootStack.Screen
          name="ExampleModal"
          component={ExampleModalScreen}
          options={{ title: t('modal.title') }}
        />
        <RootStack.Screen
          name="Feedback"
          component={FeedbackFormScreen}
          options={{ title: t('feedback.title') }}
        />
      </RootStack.Group>
    </RootStack.Navigator>
  );
}
