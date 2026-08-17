/**
 * Tier 2 — the screen-level loading/error convention. Covers the three
 * branches and the typed-error message selection.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

// Side-effect import: initialize i18n so the error copy renders in English.
import '../../../src/framework/i18n';
import { NetworkError, ServerError } from '../../../src/access/http/errors';
import {
  QueryStateView,
  type QueryLike,
} from '../../../src/presentation/components/QueryStateView';

function query<T>(overrides: Partial<QueryLike<T>>): QueryLike<T> {
  return { isPending: false, isError: false, error: null, data: undefined, ...overrides };
}

describe('QueryStateView', () => {
  it('shows a spinner while pending', async () => {
    await render(
      <QueryStateView query={query<string>({ isPending: true })}>
        {(value) => <Text>{value}</Text>}
      </QueryStateView>,
    );

    expect(screen.getByTestId('QueryLoading')).toBeOnTheScreen();
  });

  it('renders the data when loaded', async () => {
    await render(
      <QueryStateView query={query({ data: 'loaded value' })}>
        {(value) => <Text>{value}</Text>}
      </QueryStateView>,
    );

    expect(screen.getByText('loaded value')).toBeOnTheScreen();
  });

  it('shows offline copy for a NetworkError and retries on press', async () => {
    const refetch = jest.fn();
    await render(
      <QueryStateView
        query={query<string>({ isError: true, error: new NetworkError('down'), refetch })}
      >
        {(value: string) => <Text>{value}</Text>}
      </QueryStateView>,
    );

    expect(
      screen.getByText('You appear to be offline. Check your connection and try again.'),
    ).toBeOnTheScreen();

    fireEvent.press(screen.getByText('Try again'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('shows generic copy for a non-network error', async () => {
    await render(
      <QueryStateView query={query<string>({ isError: true, error: new ServerError(500, 'boom') })}>
        {(value: string) => <Text>{value}</Text>}
      </QueryStateView>,
    );

    expect(screen.getByText('Something went wrong. Please try again.')).toBeOnTheScreen();
  });
});
