import { useAuthStore } from '@/stores/authStore';

/**
 * Resolves the session for the route guard. The backend is asked once per page
 * load (restoreSession); later navigations only read the store.
 */
export async function isLoggedIn(): Promise<boolean> {
  const authStore = useAuthStore();
  if (!authStore.initialized) {
    return authStore.restoreSession();
  }
  return authStore.isAuthenticated;
}
