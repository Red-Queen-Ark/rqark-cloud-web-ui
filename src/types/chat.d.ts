type ChatSessionId = string | null | undefined;

type ChatServerMessage = { type: 'message'; content: string } | { type: 'error'; code: string; message: string };

interface ChatTurn {
  agent: string;
  provider: string;
}
