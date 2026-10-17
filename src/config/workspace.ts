export const WORKSPACE_ROOT = '';

export type WorkspaceEntryType = 'file' | 'dir' | 'link' | 'other';

export interface WorkspaceEntry {
  name: string;
  path: string;
  type: WorkspaceEntryType;
  size: number;
  mtime: number;
  target?: string | null;
}

export interface WorkspaceListing {
  path: string;
  entries: WorkspaceEntry[];
}

const SENSITIVE_NAMES = new Set(['.env', '.git-credentials', '.netrc', '.npmrc', '.pypirc', 'credentials', 'id_ed25519', 'id_rsa']);
const SENSITIVE_PREFIXES = ['.env.', 'id_rsa.', 'id_ed25519.'];

export function isSensitivePath(path: string): boolean {
  const segments = path.split('/').filter(Boolean);
  const name = segments.at(-1) ?? '';
  if (SENSITIVE_NAMES.has(name) || SENSITIVE_PREFIXES.some((prefix) => name.startsWith(prefix))) {
    return true;
  }
  return segments.includes('.git') && name === 'config';
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'avif', 'svg']);
const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown', 'mdx']);
const TEXT_EXTENSIONS = new Set([
  'txt',
  'text',
  'log',
  'csv',
  'tsv',
  'json',
  'jsonl',
  'yaml',
  'yml',
  'toml',
  'ini',
  'cfg',
  'conf',
  'env',
  'js',
  'mjs',
  'cjs',
  'ts',
  'mts',
  'cts',
  'jsx',
  'tsx',
  'vue',
  'svelte',
  'css',
  'scss',
  'less',
  'html',
  'htm',
  'xml',
  'svg',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'kt',
  'swift',
  'c',
  'h',
  'cc',
  'cpp',
  'hpp',
  'cs',
  'php',
  'sh',
  'bash',
  'zsh',
  'fish',
  'ps1',
  'sql',
  'lua',
  'pl',
  'r',
  'dart',
  'ex',
  'exs',
  'erl',
  'hs',
  'clj',
  'scala',
  'proto',
  'graphql',
  'gql',
  'diff',
  'patch',
]);

const TEXT_NAMES = new Set([
  'dockerfile',
  'makefile',
  'license',
  'licence',
  'readme',
  'changelog',
  'procfile',
  'gemfile',
  'rakefile',
  'vagrantfile',
  '.gitignore',
  '.gitattributes',
  '.dockerignore',
  '.editorconfig',
  '.prettierrc',
  '.eslintrc',
]);

export type PreviewKind = 'image' | 'pdf' | 'markdown' | 'text' | 'binary';

function extensionOf(name: string): string {
  const index = name.lastIndexOf('.');
  return index > 0 ? name.slice(index + 1).toLowerCase() : '';
}

export function previewKind(entry: Pick<WorkspaceEntry, 'name'>): PreviewKind {
  const extension = extensionOf(entry.name);
  if (IMAGE_EXTENSIONS.has(extension)) {
    return 'image';
  }
  if (extension === 'pdf') {
    return 'pdf';
  }
  if (MARKDOWN_EXTENSIONS.has(extension)) {
    return 'markdown';
  }
  if (TEXT_EXTENSIONS.has(extension) || TEXT_NAMES.has(entry.name.toLowerCase())) {
    return 'text';
  }
  return 'binary';
}

export function baseName(path: string): string {
  const segments = path.split('/').filter(Boolean);
  return segments.at(-1) ?? '';
}

export function parentOf(path: string): string {
  const segments = path.split('/').filter(Boolean);
  segments.pop();
  return segments.join('/');
}

export function joinPath(directory: string, name: string): string {
  const trimmed = directory.replace(/^\/+|\/+$/g, '');
  return trimmed ? `${trimmed}/${name}` : name;
}

export interface BreadcrumbSegment {
  name: string;
  path: string;
}

export function breadcrumbOf(path: string): BreadcrumbSegment[] {
  const segments = path.split('/').filter(Boolean);
  return segments.map((name, index) => ({ name, path: segments.slice(0, index + 1).join('/') }));
}

export function formatSize(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = size / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

export function formatMtime(mtime: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(mtime * 1000));
}

export function httpDate(mtime: number): string {
  return new Date(mtime * 1000).toUTCString();
}
