import type { NavigatorScreenParams } from '@react-navigation/native';

/**
 * Typed route maps for the whole navigation tree (guardrail: wrong route names
 * or params are type errors, and there are no string-literal routes outside
 * these types). The shell is
 * bottom tabs (Dad Jokes + Favorites) with a pushed detail and a modal.
 *
 * Forced update and the kill switch are **not** routes here: they block the app
 * from *outside* the navigator via `AppGate` (see
 * `src/presentation/shell/AppGate.tsx`), so they fully replace the shell and
 * lift automatically when the remote flag clears — see `doc/ForcedUpdate.md`.
 */

/** Jokes tab stack: list → pushed detail (keeps the tab bar). */
export type JokesStackParamList = {
  JokesList: undefined;
  JokeDetail: { jokeId: string };
};

/** Favorites tab stack (detail currently lives in the Jokes tab). */
export type FavoritesStackParamList = {
  FavoritesList: undefined;
};

/** Bottom tabs — the app's tab shell. */
export type RootTabParamList = {
  JokesTab: NavigatorScreenParams<JokesStackParamList> | undefined;
  FavoritesTab: NavigatorScreenParams<FavoritesStackParamList> | undefined;
};

/** Root native-stack: the tabs, a demo modal, and the example feedback form modal. */
export type RootStackParamList = {
  Tabs: NavigatorScreenParams<RootTabParamList> | undefined;
  ExampleModal: undefined;
  Feedback: undefined;
};

// Makes useNavigation(), useRoute(), Link, and navigationRef typed app-wide.
declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
