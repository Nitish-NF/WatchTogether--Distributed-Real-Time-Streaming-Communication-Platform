import authService from './authService.js';

let refreshPromise = null;

export const refreshOnce = async () => {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = authService.refresh()
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};