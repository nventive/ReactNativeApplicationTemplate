import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from './types';

/**
 * Imperative navigation handle — a global navigation ref. Lets non-React code
 * (e.g. the future forced-update / kill-switch
 * services) navigate without a `navigation` prop. The UI still navigates
 * through hooks; this is for the service layer.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
