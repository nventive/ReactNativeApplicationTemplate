# Serialization

How data crossing the Access boundary is (de)serialized and validated. This
template uses **zod** — a schema is both the validator and the source of the
inferred type, so there is no codegen step.

## The DTO pattern

Every DTO is one file under `src/access/<feature>/` exporting a `fooSchema` and
the inferred `Foo` type. [`Joke.ts`](../src/access/jokes/Joke.ts) is the seed
example:

```ts
import { z } from 'zod';

export const jokeSchema = z.object({
  id: z.string(),
  title: z.string(),
  text: z.string(),
});

export type Joke = z.infer<typeof jokeSchema>; // never hand-write the type
```

Conventions:

- **One schema per DTO**, named `fooSchema`, in a PascalCase file `Foo.ts`.
- **`export type Foo = z.infer<typeof fooSchema>`** — the type is derived from the
  schema, so they can never drift.
- **Field renaming / envelope mapping** (e.g. Reddit's `selftext` → `text`) is
  done in the repository with `.transform` or manual mapping, not by leaking the
  external shape upward.

## Where parsing happens

**Only at the Access boundary**, immediately after receiving raw data — an HTTP
response body, or a string read from `KeyValueStore`. Layers above Access trust
the inferred types and never re-validate.

```ts
// in a repository
const parsed = jokeSchema.array().safeParse(response.data);
if (!parsed.success) throw new ParseError(parsed.error); // typed error, see ErrorHandling.md
return parsed.data;
```

## Error behavior on invalid payloads

The two directions are treated differently on purpose:

- **Network / API payloads → fail loud.** A schema failure throws (mapped to
  `ParseError` — see [ErrorHandling.md](ErrorHandling.md)). Never return
  partially-typed data.
- **Persisted payloads (read path) → fail soft.** Stored data can be stale from
  an older app version, so a parse failure is treated as "no value": log it and
  return the default/undefined rather than throwing, so the app still boots.

## Storing objects

Persist an object as a single JSON string on write, and `JSON.parse` →
`schema.parse` on read. For a list, store one JSON-array string. See
[LocalStorage.md](LocalStorage.md).
