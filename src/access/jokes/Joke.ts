import { z } from 'zod';

/**
 * DTO for a dad joke crossing the Access boundary.
 *
 * External data is parsed with this zod schema at the boundary and the type is
 * inferred from it (the serialization pattern). The real HTTP repository parses
 * the Reddit `/r/dadjokes/top.json` envelope
 * (`data.children[].data.{id,title,selftext}`) and maps it to this flat shape.
 */
export const jokeSchema = z.object({
  id: z.string(),
  title: z.string(),
  text: z.string(),
});

export type Joke = z.infer<typeof jokeSchema>;

/**
 * Schema for the persisted favorites list — an array of the flat `Joke` DTO.
 *
 * Favorites are stored as one JSON-array string in `KeyValueStore`
 * (see `doc/LocalStorage.md`). This is a **persisted** payload, so it is parsed
 * fail-soft (`doc/Serialization.md`): corrupt data from an older app version is
 * dropped rather than thrown, so it can never brick startup.
 */
export const favoriteJokesSchema = z.array(jokeSchema);
