import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import type { JokesStackParamList } from '../navigation/types';
import { AppText, Button, Screen, useTheme } from '../theme';
import { useJokes } from './useJokes';

type Props = NativeStackScreenProps<JokesStackParamList, 'JokeDetail'>;

/**
 * Pushed detail screen. It reads the typed `jokeId` param, looks the joke up in
 * the fetched list, and favorites/unfavorites it through the same observable the
 * list and Favorites tab use — so state stays consistent across every screen.
 */
export function JokeDetailScreen({ route }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { jokeId } = route.params;
  const { jokesQuery, isFavorite, toggleFavorite } = useJokes();
  const joke = jokesQuery.data?.find((candidate) => candidate.id === jokeId);

  if (!joke) {
    return (
      <Screen padded testID="JokeDetail">
        <AppText tone="muted">{t('jokes.unavailable')}</AppText>
      </Screen>
    );
  }

  const favorite = isFavorite(joke);

  return (
    <Screen padded testID="JokeDetail">
      <AppText variant="title" style={{ marginBottom: theme.spacing.md }}>
        {joke.title}
      </AppText>
      <AppText style={{ marginBottom: theme.spacing.xl }}>{joke.text}</AppText>
      <Button
        testID="ToggleFavoriteButton"
        label={favorite ? t('jokes.removeFavorite') : t('jokes.addFavorite')}
        onPress={() => toggleFavorite(joke)}
        style={{ alignSelf: 'flex-start' }}
      />
    </Screen>
  );
}
