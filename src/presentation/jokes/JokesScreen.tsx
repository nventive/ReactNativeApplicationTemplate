import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { FlatList } from 'react-native';

import { QueryStateView } from '../components/QueryStateView';
import type { JokesStackParamList, RootStackParamList } from '../navigation/types';
import { Button, Screen, useTheme } from '../theme';
import { JokeListItem } from './JokeListItem';
import { useJokes } from './useJokes';

/**
 * The Dad Jokes list — jokes fetched through all three layers (screen → hook →
 * business service → repository), rendered inside the navigation shell.
 *
 * Loading/error states come from `QueryStateView` (the screen-level
 * loading/error convention). The `DadJokesContainer` testID gives the smoke
 * flows a stable selector. Row tap toggles
 * favorite; the chevron pushes the detail screen; the header button presents the
 * example modal. All copy is localized and all styling comes from the theme.
 */
export function JokesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<JokesStackParamList>>();
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { jokesQuery, isFavorite, toggleFavorite } = useJokes();

  return (
    <Screen>
      <QueryStateView query={jokesQuery}>
        {(jokes) => (
          <FlatList
            testID="DadJokesContainer"
            data={jokes}
            keyExtractor={(joke) => joke.id}
            ListHeaderComponent={
              <Button
                testID="OpenModalButton"
                variant="outline"
                label={t('jokes.openModal')}
                onPress={() => rootNavigation.navigate('ExampleModal')}
                style={{
                  marginHorizontal: theme.spacing.lg,
                  marginTop: theme.spacing.md,
                  marginBottom: theme.spacing.xs,
                }}
              />
            }
            renderItem={({ item }) => (
              <JokeListItem
                joke={item}
                isFavorite={isFavorite(item)}
                onToggleFavorite={toggleFavorite}
                onOpenDetail={(joke) => navigation.navigate('JokeDetail', { jokeId: joke.id })}
              />
            )}
            contentContainerStyle={{ paddingBottom: theme.spacing.lg }}
          />
        )}
      </QueryStateView>
    </Screen>
  );
}
