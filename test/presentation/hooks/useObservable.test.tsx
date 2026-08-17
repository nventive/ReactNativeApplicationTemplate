/**
 * Tier 2 — React runtime, headless. Proves that a component
 * re-renders when a `BehaviorSubject` behind a service observable emits.
 */
import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { BehaviorSubject, type Observable } from 'rxjs';

import { RecordingAnalyticsSink } from '../../../src/access/analytics/RecordingAnalyticsSink';
import { InMemoryKeyValueStore } from '../../../src/access/storage/InMemoryKeyValueStore';
import { MockLogger } from '../../../src/access/logger/MockLogger';
import { DefaultJokesService } from '../../../src/business/jokes/DefaultJokesService';
import { useObservable } from '../../../src/presentation/hooks/useObservable';

function Probe({ source$ }: { source$: Observable<string> }) {
  const value = useObservable(source$, 'initial');
  return <Text>{value}</Text>;
}

function FavoritesCount({ service }: { service: DefaultJokesService }) {
  const favorites = useObservable(service.favorites$, []);
  return <Text>{`favorites: ${favorites.length}`}</Text>;
}

describe('useObservable', () => {
  it('re-renders the component on every emission', async () => {
    const subject = new BehaviorSubject('first');

    await render(<Probe source$={subject.asObservable()} />);
    expect(screen.getByText('first')).toBeOnTheScreen();

    await act(() => {
      subject.next('second');
    });

    expect(screen.getByText('second')).toBeOnTheScreen();
  });

  it('re-renders when a BehaviorSubject in a business service emits', async () => {
    const service = new DefaultJokesService(
      { getJokes: () => Promise.resolve([]) },
      new InMemoryKeyValueStore(),
      new MockLogger(),
      new RecordingAnalyticsSink(),
    );

    await render(<FavoritesCount service={service} />);
    expect(screen.getByText('favorites: 0')).toBeOnTheScreen();

    await act(() => {
      service.toggleFavorite({ id: 'x', title: 'T', text: 'X' });
    });

    expect(screen.getByText('favorites: 1')).toBeOnTheScreen();
  });
});
