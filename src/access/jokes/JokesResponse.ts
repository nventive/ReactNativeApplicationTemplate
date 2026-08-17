import { z } from 'zod';

import type { Joke } from './Joke';

/**
 * The Reddit listing envelope returned by `/r/dadjokes/top.json`.
 *
 * Only the fields the feature needs are declared — zod strips the rest, so the
 * huge Reddit payload never leaks upward. The nested listing envelope is
 * collapsed into a single schema.
 *
 * This is the external DTO; the repository maps it to the flat, app-facing
 * `Joke` shape with {@link toJokes} (envelope mapping happens at the Access
 * boundary — `doc/Serialization.md`).
 */
const jokeChildSchema = z.object({
  data: z.object({
    id: z.string(),
    title: z.string(),
    selftext: z.string(),
  }),
});

export const jokesResponseSchema = z.object({
  data: z.object({
    children: z.array(jokeChildSchema),
  }),
});

export type JokesResponse = z.infer<typeof jokesResponseSchema>;

/** Maps the raw Reddit envelope to the flat `Joke` DTO (`selftext` → `text`). */
export function toJokes(response: JokesResponse): Joke[] {
  return response.data.children.map((child) => ({
    id: child.data.id,
    title: child.data.title,
    text: child.data.selftext,
  }));
}
