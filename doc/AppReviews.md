# App reviews

Prompt the user to rate the app on the store — the native "in-app review" flow —
at a **positive moment**, rate-limited so it never annoys. It is built as the RN
idiom over
[`expo-store-review`](https://docs.expo.dev/versions/latest/sdk/storereview/).

The native call sits behind an Access **gateway**; the *when* — availability plus
rate-limiting — lives in a small Business **service**, so nothing throws a review
prompt at the user without going through the policy.

## The layers

**Access — the native seam.**
[`AppReviewGateway`](../src/access/appReview/AppReviewGateway.ts):

```ts
interface AppReviewGateway {
  isAvailable(): Promise<boolean>; // expo-store-review hasAction(): capability + configured store URLs
  requestReview(): Promise<void>; // asks the OS to present its prompt (it decides whether to show it)
}
```

| Implementation | Role |
|----------------|------|
| [`ExpoStoreReviewGateway`](../src/access/appReview/ExpoStoreReviewGateway.ts) | **default (device)** — the only `expo-store-review` touchpoint |
| [`InMemoryAppReviewGateway`](../src/access/appReview/InMemoryAppReviewGateway.ts) | records requests; used by tests and fully-offline (mock) runs |

**Business — the policy.**
[`AppReviewService`](../src/business/appReview/AppReviewService.ts) exposes one
call, `requestReviewIfAppropriate()`. [`DefaultAppReviewService`](../src/business/appReview/DefaultAppReviewService.ts)
enforces the two store-guideline rules:

- prompt only after **N positive signals** (`DEFAULT_SIGNAL_THRESHOLD = 3`), and
- prompt **at most once per installed app version**.

State (signal count, last-prompted version) is persisted in the injected
[`KeyValueStore`](LocalStorage.md), so it survives restarts; the installed
version comes from [`CurrentVersionRepository`](../src/access/appInfo/CurrentVersionRepository.ts).
The call never throws — a review prompt must not break the flow that triggered it.

## Using it

From Presentation, read the thin
[`useAppReview`](../src/presentation/appReview/useAppReview.ts) hook and call it at
a genuinely positive moment. The app wires it to the **feedback form's
successful submit** (a completed flow) — see [Forms.md](Forms.md):

```ts
const { requestReviewIfAppropriate } = useAppReview();
// …after the user completes something positive:
await requestReviewIfAppropriate();
```

Pick real positive moments in a project (a task completed, a few items favorited);
never a failure/error path.

## Wiring

Selected in [`createServices.ts`](../src/framework/composition/createServices.ts):
the `InMemoryAppReviewGateway` when mocking is on (keeps offline runs off native),
the `ExpoStoreReviewGateway` otherwise. `expo-store-review` is a **default**
dependency (not an opt-in vendor SDK like Firebase/Bugsee), installed with
`npx expo install expo-store-review`.

## Testing

- Tier 1: [`DefaultAppReviewService.test.ts`](../test/business/appReview/DefaultAppReviewService.test.ts)
  proves the threshold, once-per-version guard, unavailable no-op, restart
  persistence, and the never-throws contract against the in-memory gateway.
- On device: because the OS heavily rate-limits (and never confirms) the prompt,
  verify by lowering the threshold temporarily or repeating the positive moment.
  On iOS the real prompt only appears on a release/TestFlight build, not in the
  simulator.
