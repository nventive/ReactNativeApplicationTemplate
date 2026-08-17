import { Pressable, Text, View } from 'react-native';

import type { Joke } from '../../access/jokes/Joke';
import { AppText, Card, useTheme } from '../theme';

// Decorative glyphs (not translatable copy).
const HEART_FILLED = '♥';
const HEART_OUTLINE = '♡';
const CHEVRON = '›';

/**
 * A single joke row. Tapping the row toggles favorite; an optional
 * chevron opens the pushed detail screen (a navigation affordance that must not
 * disturb the favorite-on-tap behavior). All colors/spacing come from the theme.
 */
export function JokeListItem({
  joke,
  isFavorite,
  onToggleFavorite,
  onOpenDetail,
}: {
  joke: Joke;
  isFavorite: boolean;
  onToggleFavorite: (joke: Joke) => void;
  onOpenDetail?: (joke: Joke) => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      testID={`JokeListItem-${joke.id}`}
      accessibilityRole="button"
      onPress={() => onToggleFavorite(joke)}
      style={{ marginHorizontal: theme.spacing.lg, marginVertical: theme.spacing.xs }}
    >
      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, marginRight: theme.spacing.md }}>
          <AppText variant="heading">{joke.title}</AppText>
          <AppText variant="subtitle" tone="muted" style={{ marginTop: theme.spacing.xs }}>
            {joke.text}
          </AppText>
        </View>
        <Text
          style={{
            fontSize: 24,
            color: isFavorite ? theme.colors.favorite : theme.colors.onSurfaceMuted,
          }}
        >
          {isFavorite ? HEART_FILLED : HEART_OUTLINE}
        </Text>
        {onOpenDetail ? (
          <Pressable
            testID={`JokeDetailButton-${joke.id}`}
            accessibilityRole="button"
            onPress={() => onOpenDetail(joke)}
            hitSlop={8}
            style={{ paddingLeft: theme.spacing.md }}
          >
            <Text style={{ fontSize: 24, color: theme.colors.onSurfaceMuted }}>{CHEVRON}</Text>
          </Pressable>
        ) : null}
      </Card>
    </Pressable>
  );
}
