/**
 * The central React Query key factory.
 *
 * Convention: every `useQuery`/`useMutation` key comes from
 * this factory — never an ad-hoc inline array. Keys are grouped by feature and
 * built hierarchically so related queries can be invalidated together (e.g.
 * `queryClient.invalidateQueries({ queryKey: queryKeys.jokes.all })`).
 */
export const queryKeys = {
  jokes: {
    all: ['jokes'] as const,
    list: () => [...queryKeys.jokes.all, 'list'] as const,
  },
};
