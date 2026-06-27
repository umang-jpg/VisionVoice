import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

/**
 * Navigate to a specific route programmatically from outside React components.
 * @param {string} name - The name of the route to navigate to.
 * @param {object} [params] - Optional parameters for the route.
 */
export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}
