/**
 * Tier 2 — React runtime, headless. A render smoke test for the example form
 * screen: it proves the `Controller` + design-system `TextField` wiring mounts
 * inside the navigator with all fields and localized labels. The submit behavior
 * (validation, analytics, review, success) is covered deterministically by
 * `useFeedbackForm.test.tsx` and `feedbackForm.test.ts`, which drive the async
 * zod resolver without the button's fire-and-forget path.
 */
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Side-effect import: initialize i18n so the form renders English copy.
import '../../../src/framework/i18n';
import { createServices } from '../../../src/framework/composition/createServices';
import { ServicesProvider } from '../../../src/framework/composition/ServicesProvider';
import { FeedbackFormScreen } from '../../../src/presentation/forms/FeedbackFormScreen';
import { ThemeProvider } from '../../../src/presentation/theme';

const Stack = createNativeStackNavigator();

async function renderScreen() {
  const services = createServices();
  await render(
    <SafeAreaProvider>
      <ThemeProvider>
        <ServicesProvider services={services}>
          <NavigationContainer>
            <Stack.Navigator>
              <Stack.Screen
                name="Feedback"
                component={FeedbackFormScreen}
                options={{ headerShown: false }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </ServicesProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('FeedbackFormScreen', () => {
  it('renders every field with its localized label and the submit button', async () => {
    await renderScreen();

    expect(await screen.findByTestId('FeedbackForm')).toBeOnTheScreen();
    expect(screen.getByTestId('FeedbackName')).toBeOnTheScreen();
    expect(screen.getByTestId('FeedbackEmail')).toBeOnTheScreen();
    expect(screen.getByTestId('FeedbackMessage')).toBeOnTheScreen();
    expect(screen.getByTestId('FeedbackSubmit')).toBeOnTheScreen();
    expect(screen.getByText('Name')).toBeOnTheScreen();
    expect(screen.getByText('Email')).toBeOnTheScreen();
    expect(screen.getByText('Message')).toBeOnTheScreen();
  });
});
