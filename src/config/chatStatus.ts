export type ChatStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface ChatStatusSpec {
  /** DaisyUI `status` modifier classes; empty when no dot should show. */
  dot: string;
  /** i18n key for the dot's label; empty when no dot should show. */
  label: string;
}

export const CHAT_STATUS: Record<ChatStatus, ChatStatusSpec> = {
  idle: { dot: '', label: '' },
  connecting: { dot: 'status-warning animate-pulse', label: 'chat.statusConnecting' },
  connected: { dot: 'status-success', label: 'chat.statusConnected' },
  error: { dot: 'status-error', label: 'chat.statusError' },
};
