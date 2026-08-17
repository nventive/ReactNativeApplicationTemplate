/**
 * Tier 2 — the app-shell error boundary. Catches a render-phase crash,
 * reports it, and recovers.
 */
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

// Side-effect import: initialize i18n so the fallback copy renders in English.
import '../../../src/framework/i18n';
import { AppErrorBoundary } from '../../../src/presentation/shell/AppErrorBoundary';

function Boom(): never {
  throw new Error('render crash');
}

describe('AppErrorBoundary', () => {
  it('renders children when nothing throws', async () => {
    await render(
      <AppErrorBoundary>
        <Text>healthy child</Text>
      </AppErrorBoundary>,
    );

    expect(screen.getByText('healthy child')).toBeOnTheScreen();
  });

  it('catches a render error, reports it, and shows the fallback', async () => {
    // React logs the caught error to console.error — silence it for a clean run.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const onError = jest.fn();

    await render(
      <AppErrorBoundary onError={onError}>
        <Boom />
      </AppErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(screen.getByText('Something went wrong')).toBeOnTheScreen();

    consoleError.mockRestore();
  });

  it('renders a custom fallback when provided', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await render(
      <AppErrorBoundary fallback={() => <Text>custom fallback</Text>}>
        <Boom />
      </AppErrorBoundary>,
    );

    expect(screen.getByText('custom fallback')).toBeOnTheScreen();

    consoleError.mockRestore();
  });
});
