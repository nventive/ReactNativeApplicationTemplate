import type { Joke } from './Joke';
import type { JokesRepository } from './JokesRepository';

/**
 * Mock implementation serving fixture data, so the app runs and is testable
 * without a live backend (the mocking principle). It is the default repository
 * in development (selected in the composition root) and the one the runtime
 * mocking toggle can force in any environment.
 *
 * A handful of fixtures flattened to the `Joke` DTO shape so the list feels
 * populated. Each conforms to `jokeSchema`.
 */
export class MockJokesRepository implements JokesRepository {
  private static readonly jokes: Joke[] = [
    {
      id: '17urj7q',
      title: 'My wife just completed a 40 week body building program this morning',
      text: "It's a girl and weighs 7lbs 12 oz.",
    },
    {
      id: '17uebld',
      title: 'My family is getting sick of me telling dad jokes 24/7',
      text: 'Or should I say “they are sick of me telling dad jokes 3.428571428571429”?',
    },
    {
      id: 'mock-boat',
      title: 'I only know 25 letters of the alphabet',
      text: "I don't know why.",
    },
    {
      id: 'mock-atom',
      title: 'Never trust an atom',
      text: 'They make up everything.',
    },
    {
      id: 'mock-elevator',
      title: 'I have a fear of elevators',
      text: "I'm taking steps to avoid them.",
    },
    {
      id: 'mock-scientist',
      title: 'What do you call a scientist who never smiles?',
      text: 'A cynologist... no wait, a chemist who has lost their solutions.',
    },
  ];

  getJokes(): Promise<Joke[]> {
    return Promise.resolve(MockJokesRepository.jokes);
  }
}
