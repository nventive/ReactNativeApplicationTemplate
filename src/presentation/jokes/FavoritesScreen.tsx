import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { FlatList } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { AppText, Button, Screen, useTheme } from '../theme';
import { JokeListItem } from './JokeListItem';
import { useJokes } from './useJokes';

/**
 * The Favorites tab. Reads the live `favorites$` observable (via `useJokes`), so
 * favoriting a joke on the Dad Jokes tab — or the detail screen — shows up here
 * immediately: the cross-screen consistency the RxJS source of truth provides.
 *
 * The header also opens the example feedback form, the template's
 * canonical `react-hook-form` + `zod` pattern, presented as a root modal.
 */
export function FavoritesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { favorites, isFavorite, toggleFavorite } = useJokes();

  const feedbackButton = (
    <Button
      testID="OpenFeedbackButton"
      variant="outline"
      label={t('feedback.open')}
      onPress={() => navigation.navigate('Feedback')}
      style={{ margin: theme.spacing.lg }}
    />
  );

  if (favorites.length === 0) {
    return (
      <Screen center padded testID="FavoritesEmpty">
        <AppText tone="muted" style={{ textAlign: 'center', marginBottom: theme.spacing.lg }}>
          {t('favorites.empty')}
        </AppText>
        {feedbackButton}
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        testID="FavoritesContainer"
        data={favorites}
        keyExtractor={(joke) => joke.id}
        ListHeaderComponent={feedbackButton}
        renderItem={({ item }) => (
          <JokeListItem
            joke={item}
            isFavorite={isFavorite(item)}
            onToggleFavorite={toggleFavorite}
          />
        )}
        contentContainerStyle={{ paddingVertical: theme.spacing.sm }}
      />
    </Screen>
  );
}
