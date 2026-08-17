// Global test setup (merged with jest-expo's own setupFiles in jest.config.js).

// react-native-safe-area-context's real SafeAreaProvider defers rendering its
// children until it measures layout via onLayout, which never fires headless —
// so the tree renders empty in Jest. Substitute a synchronous mock that yields
// zero insets, matching the approach the library documents for tests.
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  const passthrough = ({ children }) => React.createElement(React.Fragment, null, children);
  return {
    SafeAreaProvider: passthrough,
    SafeAreaView: passthrough,
    SafeAreaInsetsContext: React.createContext(insets),
    SafeAreaFrameContext: React.createContext(frame),
    SafeAreaConsumer: ({ children }) => children(insets),
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    withSafeAreaInsets: (Component) => (props) =>
      React.createElement(Component, { ...props, insets }),
    initialWindowMetrics: { insets, frame },
  };
});
