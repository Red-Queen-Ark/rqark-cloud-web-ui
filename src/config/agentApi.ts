function agentApiBaseUrl(): string {
  return import.meta.env.VITE_AGENT_API_BASE_URL || '/agent-api';
}

export function agentApiUrl(path: string): string {
  return `${agentApiBaseUrl().replace(/\/+$/, '')}${path}`;
}
