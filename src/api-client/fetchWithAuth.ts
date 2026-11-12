import { refreshSession } from '@/api-client/runtime';
import { apiFetch } from '@/config/runtime';
import { useAuthStore } from '@/stores/authStore';

export async function fetchWithAuth(input: string, init: RequestInit = {}): Promise<Response> {
  const auth = useAuthStore();

  async function send(): Promise<Response> {
    const headers = new Headers(init.headers);
    if (auth.accessToken) {
      headers.set('Authorization', `Bearer ${auth.accessToken}`);
    }
    return apiFetch(input, { ...init, headers });
  }

  const response = await send();
  if (response.status !== 401 || !(await refreshSession())) {
    return response;
  }

  return send();
}
