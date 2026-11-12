import { Call } from '@wailsio/runtime';
import type { ServerConfig } from '@/config/runtime';

/**
 * The settings the Go side owns.
 *
 * The addresses live there because the asset proxy, which happens in Go, needs
 * them on every request. This is the only place the frontend reaches across the
 * bridge for them.
 */
export async function loadServerConfig(): Promise<ServerConfig> {
  return (await Call.ByName('main.SettingsService.Load')) as ServerConfig;
}

export async function saveServerConfig(config: ServerConfig): Promise<void> {
  await Call.ByName('main.SettingsService.Save', config);
}
