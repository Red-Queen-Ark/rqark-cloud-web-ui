import { ref } from 'vue';
import { agentApiUrl } from '@/config/agentApi';

const PROBE_TIMEOUT_MS = 3000;

/**
 * Whether this agent cloud mounts the speech routes at all.
 *
 * A deployment with SPEECH_ENABLED=false does not register /asr or /voice. The control is
 * hidden until the probe actually confirms the route answers: a deployment that keeps
 * speech off should not show a dead microphone, and a probe that never lands is no proof
 * that it is on.
 */
const available = ref(false);
let probed = false;
let inFlight: Promise<void> | null = null;

async function load(): Promise<void> {
  if (probed || inFlight) {
    await inFlight;
    return;
  }

  inFlight = (async () => {
    try {
      const response = await fetch(agentApiUrl('/asr/health'), { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
      available.value = response.ok;
    } catch {
      available.value = false;
    } finally {
      probed = true;
      inFlight = null;
    }
  })();

  await inFlight;
}

/** For tests: forget the cached answer, as a fresh page load would. */
export function resetSpeechAvailability(): void {
  available.value = false;
  probed = false;
  inFlight = null;
}

export function useSpeechAvailability() {
  return { available, load };
}
