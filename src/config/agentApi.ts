import { agentApiBaseUrl } from '@/config/runtime';

export function agentApiUrl(path: string): string {
  return `${agentApiBaseUrl()}${path}`;
}
