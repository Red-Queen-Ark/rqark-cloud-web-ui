import type { ApiProjectDto } from '@/api';

/**
 * How a project is named in a sentence: the name the user gave it.
 *
 * `project_path` is never the label. Two projects may be renamed freely, and the
 * path is only what the agent works in.
 */
export function projectLabel(project?: Pick<ApiProjectDto, 'project_name'> | null): string {
  return project?.project_name ?? '';
}

/** The directory a project works in, spelled the way the sandbox sees it. */
export function projectPathLabel(path?: string | null): string {
  const trimmed = (path ?? '').trim();
  return trimmed ? `/workspace/${trimmed}` : '/workspace';
}

export interface ProjectPathCheck {
  ok: boolean;
  /** The path as it would be stored: trimmed, with doubled and trailing slashes collapsed. */
  path: string;
  /** An i18n key under `projects`, when the path is refused. */
  error?: string;
}

/**
 * Checks a project path the same way the data cloud does, so the dialog can
 * refuse a path before it reaches the wire.
 *
 * The stored value is relative to the sandbox volume root. An absolute path, a
 * `..` segment or a backslash can never name a directory inside the volume, so
 * all three are refused here rather than left to the server.
 */
export function checkProjectPath(raw: string): ProjectPathCheck {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, path: '', error: 'pathRequired' };
  }
  if (trimmed.startsWith('/')) {
    return { ok: false, path: trimmed, error: 'pathNoLeadingSlash' };
  }
  if (trimmed.includes('\\')) {
    return { ok: false, path: trimmed, error: 'pathNoBackslash' };
  }
  if (trimmed.split('/').includes('..')) {
    return { ok: false, path: trimmed, error: 'pathNoParent' };
  }

  const normalized = trimmed
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.')
    .join('/');
  if (!normalized) {
    return { ok: false, path: '', error: 'pathRequired' };
  }
  return { ok: true, path: normalized };
}

/**
 * Checks a project name: one line, no control characters, within the column.
 * An empty name is refused because the picker would have nothing to show.
 */
export function checkProjectName(raw: string): { ok: boolean; name: string; error?: string } {
  const name = raw.trim();
  if (!name) {
    return { ok: false, name, error: 'nameRequired' };
  }
  if (/[\u0000-\u001f\u007f]/.test(name)) {
    return { ok: false, name, error: 'nameInvalid' };
  }
  if ([...name].length > 64) {
    return { ok: false, name, error: 'nameTooLong' };
  }
  return { ok: true, name };
}

/** The last segment of a path, which is what a new project defaults its name to. */
export function basename(path: string): string {
  const segments = path.split('/').filter(Boolean);
  return segments.at(-1) ?? '';
}
