const DISPLAY_KEY_MAP: Record<string, string> = {
  read_file: 'path',
  write_file: 'path',
  edit_file: 'path',
  list_dir: 'path',
  web_search: 'query',
  web_fetch: 'url',
  exec: 'command',
  shell: 'command',
  grep: 'pattern',
  subagent: 'prompt',
  plan_update: 'items',
};

const PLAN_STATUS_EMOJI: Record<string, string> = {
  pending: '⏳',
  in_progress: '🔄',
  completed: '✅',
  cancelled: '❌',
};

const DETAIL_MAX_LENGTH = 80;

export function getDisplayKey(toolName: string): string {
  return DISPLAY_KEY_MAP[toolName] ?? '';
}

export function parseToolArguments(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function truncate(value: string): string {
  return value.length > DETAIL_MAX_LENGTH ? `${value.slice(0, DETAIL_MAX_LENGTH)}…` : value;
}

function formatPlanUpdateDetail(items: unknown[]): string {
  if (items.length === 0) {
    return 'cleared';
  }
  const parts = items.map((item) => {
    const raw = (item ?? {}) as Record<string, unknown>;
    const emoji = PLAN_STATUS_EMOJI[String(raw.status ?? '')] ?? '';
    return `${emoji} ${String(raw.content ?? '')}`.trim();
  });
  return truncate(parts.join(', '));
}

export function formatToolDetail(toolName: string, args: Record<string, unknown>): string {
  const displayKey = getDisplayKey(toolName);
  if (!displayKey) {
    return '';
  }

  const value = args[displayKey];
  if (value === undefined || value === null) {
    return '';
  }

  // A plan update is read as its whole list before the empty-string guard below:
  // an empty list stringifies to '', and "cleared" is exactly what that means.
  if (toolName === 'plan_update' && Array.isArray(value)) {
    return formatPlanUpdateDetail(value);
  }

  const text = String(value);
  if (!text) {
    return '';
  }

  if (toolName === 'grep') {
    const path = String(args['path'] ?? '');
    return path && path !== '.' ? `"${text}" in ${path}` : `"${text}"`;
  }

  if (toolName === 'exec' || toolName === 'shell') {
    return text;
  }

  return truncate(text);
}

export function toolDetailFromCall(call: ChatToolCall): string {
  const args = parseToolArguments(call.function.arguments);
  if (!args) {
    return '';
  }
  return formatToolDetail(call.function.name, args);
}
