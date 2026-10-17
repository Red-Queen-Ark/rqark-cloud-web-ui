import type { Page, Route } from '@playwright/test';

export interface MockWorkspaceNode {
  type: 'file' | 'dir';
  content: Buffer;
  mtime: number;
}

export interface MockWorkspace {
  nodes: Map<string, MockWorkspaceNode>;
  requests: string[];
}

export interface MockWorkspaceOptions {
  /** Replaces the seeded files, keyed by workspace relative path. */
  files?: Record<string, string>;
  /** Replaces the seeded folders. Parents come before their children. */
  folders?: string[];
}

const MTIME = 1_782_000_000;
const ROOT = '';

export function parentPath(path: string): string {
  const segments = path.split('/').filter(Boolean);
  segments.pop();
  return segments.join('/');
}

export function joinPath(directory: string, name: string): string {
  return directory ? `${directory}/${name}` : name;
}

export function baseName(path: string): string {
  return path.split('/').filter(Boolean).at(-1) ?? '';
}

function entryPayload(path: string, node: MockWorkspaceNode) {
  return { name: baseName(path), path, type: node.type, size: node.type === 'dir' ? 4096 : node.content.length, mtime: node.mtime, target: null };
}

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

function isSensitive(path: string) {
  const name = baseName(path);
  return name === '.env' || (name === 'config' && path.includes('.git/'));
}

function children(state: MockWorkspace, directory: string, showHidden: boolean) {
  return [...state.nodes.entries()]
    .filter(([path]) => path !== ROOT && parentPath(path) === directory)
    .filter(([path]) => showHidden || !baseName(path).startsWith('.'))
    .map(([path, node]) => entryPayload(path, node))
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
}

function removeSubtree(state: MockWorkspace, path: string) {
  for (const candidate of [...state.nodes.keys()]) {
    if (candidate === path || candidate.startsWith(`${path}/`)) {
      state.nodes.delete(candidate);
    }
  }
}

export async function mockWorkspaceApi(page: Page, options: MockWorkspaceOptions = {}): Promise<MockWorkspace> {
  const nodes = new Map<string, MockWorkspaceNode>();
  nodes.set(ROOT, { type: 'dir', content: Buffer.alloc(0), mtime: MTIME });
  const folders = options.folders ?? ['docs', '.git'];
  const files = options.files ?? {
    'notes.md': '# Notes\n\n- one\n- two\n',
    'docs/plan.txt': 'ship it\n',
    'photo.png': '',
    '.env': 'TOKEN=secret\n',
    '.git/config': '[remote "origin"]\n\turl = https://x-access-token:secret@example.com/r.git\n',
  };
  for (const path of folders) {
    nodes.set(path, { type: 'dir', content: Buffer.alloc(0), mtime: MTIME });
  }
  for (const [path, content] of Object.entries(files)) {
    nodes.set(path, { type: 'file', content: Buffer.from(content), mtime: MTIME });
  }

  const state: MockWorkspace = { nodes, requests: [] };

  await page.route(
    (url) => url.pathname.startsWith('/agent-api/workspace'),
    async (route) => {
      const url = new URL(route.request().url());
      const path = decodeURIComponent(url.searchParams.get('path') ?? '');
      const method = route.request().method();
      state.requests.push(`${method} ${url.pathname.replace(/^\/agent-api/, '')} ${path}`);

      const endpoint = url.pathname.replace(/^\/agent-api\/workspace/, '');
      const node = state.nodes.get(path);

      if (endpoint === '/list' && method === 'GET') {
        if (!node) {
          return json(route, 404, { error: { code: 'FILE_NOT_FOUND', message: `path not found: ${path}` } });
        }
        if (node.type !== 'dir') {
          return json(route, 400, { error: { code: 'NOT_A_DIRECTORY', message: 'not a directory' } });
        }
        return json(route, 200, { path, entries: children(state, path, url.searchParams.get('show_hidden') === 'true') });
      }

      if (endpoint === '/stat' && method === 'GET') {
        if (!node) {
          return json(route, 404, { error: { code: 'FILE_NOT_FOUND', message: `path not found: ${path}` } });
        }
        return json(route, 200, entryPayload(path, node));
      }

      if (endpoint === '/file' && method === 'GET') {
        if (!node) {
          return json(route, 404, { error: { code: 'FILE_NOT_FOUND', message: `path not found: ${path}` } });
        }
        const body = isSensitive(path) ? Buffer.from('url = https://***@example.com/r.git\n') : node.content;
        return route.fulfill({
          status: 200,
          contentType: 'text/plain',
          headers: { 'Content-Disposition': `attachment; filename="${baseName(path)}"`, 'X-Content-Redacted': String(isSensitive(path)) },
          body,
        });
      }

      if (endpoint === '/archive' && method === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/zip', headers: { 'Content-Disposition': `attachment; filename="workspace.zip"` }, body: 'PK' });
      }

      if (endpoint === '/upload' && method === 'POST') {
        const raw = route.request().postDataBuffer()?.toString('latin1') ?? '';
        const names = [...raw.matchAll(/filename="([^"]+)"/g)].map((match) => match[1]);
        if (names.length === 0) {
          return json(route, 400, { error: { code: 'BAD_REQUEST', message: 'no files' } });
        }
        const created = names.map((name) => {
          const target = joinPath(path, name);
          state.nodes.set(target, { type: 'file', content: Buffer.alloc(0), mtime: MTIME });
          return entryPayload(target, state.nodes.get(target) as MockWorkspaceNode);
        });
        return json(route, 200, { entries: created });
      }

      if (endpoint === '/file' && method === 'PUT') {
        const content = route.request().postDataBuffer() ?? Buffer.alloc(0);
        state.nodes.set(path, { type: 'file', content, mtime: MTIME + 60 });
        return json(route, 200, entryPayload(path, state.nodes.get(path) as MockWorkspaceNode));
      }

      if (endpoint === '/mkdir' && method === 'POST') {
        state.nodes.set(path, { type: 'dir', content: Buffer.alloc(0), mtime: MTIME });
        return json(route, 200, entryPayload(path, state.nodes.get(path) as MockWorkspaceNode));
      }

      if (endpoint === '/file' && method === 'PATCH') {
        const body = route.request().postDataJSON() as { new_path?: string };
        const target = body.new_path ?? '';
        if (!node) {
          return json(route, 404, { error: { code: 'FILE_NOT_FOUND', message: `path not found: ${path}` } });
        }
        if (state.nodes.has(target)) {
          return json(route, 409, { error: { code: 'CONFLICT', message: `target already exists: ${target}` } });
        }
        state.nodes.delete(path);
        state.nodes.set(target, node);
        return json(route, 200, entryPayload(target, node));
      }

      if (endpoint === '' && method === 'DELETE') {
        if (!node) {
          return json(route, 404, { error: { code: 'FILE_NOT_FOUND', message: `path not found: ${path}` } });
        }
        removeSubtree(state, path);
        return json(route, 200, { path, deleted: true });
      }

      return json(route, 404, { error: { code: 'BAD_REQUEST', message: `Unmocked ${method} ${endpoint}` } });
    },
  );

  return state;
}
