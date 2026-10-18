import { getSops, type ApiSopDto } from '@/api';
import { ref } from 'vue';

/**
 * The caller's SOPs, read once per page load. The list is per-user and changes
 * only when the user edits it elsewhere, so a single read is enough for the
 * slash panel; the cache is module wide so a second chat page does not ask
 * again.
 */
const sops = ref<ApiSopDto[]>([]);
let loaded = false;
let inFlight: Promise<void> | null = null;

async function load(): Promise<void> {
  if (loaded || inFlight) {
    await inFlight;
    return;
  }

  inFlight = (async () => {
    try {
      const result = await getSops();
      // A deployment without the data cloud has no /sops route, and a rejected
      // read is not worth an alert: the panel simply offers the built-ins.
      if (result.error || !result.data) {
        return;
      }
      sops.value = result.data.items ?? [];
      loaded = true;
    } catch {
      // Network failures are as silent as an error body: the built-ins remain.
    } finally {
      inFlight = null;
    }
  })();

  await inFlight;
}

/** For tests: forget the cached list, as a fresh page load would. */
export function resetSopList(): void {
  sops.value = [];
  loaded = false;
  inFlight = null;
}

export function useSopList() {
  return { sops, load };
}
