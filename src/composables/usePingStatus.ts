import { onMounted, ref } from 'vue';
import { agentApiUrl } from '@/config/agentApi';
import type { ChatStatus } from '@/config/chatStatus';

const PING_TIMEOUT_MS = 5000;

export function usePingStatus() {
  const status = ref<ChatStatus>('idle');

  async function check() {
    status.value = 'connecting';
    try {
      const response = await fetch(agentApiUrl('/ping'), { signal: AbortSignal.timeout(PING_TIMEOUT_MS) });
      status.value = response.ok ? 'connected' : 'error';
    } catch {
      status.value = 'error';
    }
  }

  onMounted(check);

  return { status, check };
}
