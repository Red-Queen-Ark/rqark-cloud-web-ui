import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchWithAuth = vi.hoisted(() => vi.fn());
const refreshSession = vi.hoisted(() => vi.fn());

vi.mock('./fetchWithAuth', () => ({ fetchWithAuth }));
vi.mock('./runtime', () => ({ refreshSession }));
vi.mock('@/config/agentApi', () => ({ agentApiUrl: (path: string) => `/agent-api${path}` }));

const { WorkspaceApiError, deleteWorkspaceEntry, downloadWorkspaceFile, listWorkspace, writeWorkspaceFile } = await import('./workspace');

function response(body: unknown, init: ResponseInit = {}) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), init);
}

describe('workspace api client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends the path and the hidden flag', async () => {
    fetchWithAuth.mockResolvedValue(response({ path: 'docs', entries: [] }));

    await listWorkspace('docs', true);

    expect(fetchWithAuth.mock.calls[0][0]).toBe('/agent-api/workspace/list?path=docs&show_hidden=true');
  });

  it('encodes the path instead of pasting it into the url', async () => {
    fetchWithAuth.mockResolvedValue(response({ path: '', entries: [] }));

    await listWorkspace('a b/c&d.txt');

    expect(fetchWithAuth.mock.calls[0][0]).toBe('/agent-api/workspace/list?path=a+b%2Fc%26d.txt&show_hidden=false');
  });

  it('raises the backend error', async () => {
    fetchWithAuth.mockResolvedValue(response({ error: { code: 'FILE_NOT_FOUND', message: 'path not found: nope' } }, { status: 404 }));

    await expect(listWorkspace('nope')).rejects.toMatchObject({ status: 404, error: { code: 'FILE_NOT_FOUND' } });
  });

  it('prefers the utf-8 filename of a download', async () => {
    fetchWithAuth.mockResolvedValue(response('hello', { headers: { 'Content-Disposition': `attachment; filename="fallback.txt"; filename*=UTF-8''%E8%A8%88%E5%8A%83.txt` } }));

    const file = await downloadWorkspaceFile('docs/計劃.txt', 'fallback.txt');

    expect(file.filename).toBe('計劃.txt');
    expect(file.blob.size).toBe(5);
  });

  it('falls back to the plain filename', async () => {
    fetchWithAuth.mockResolvedValue(response('hello', { headers: { 'Content-Disposition': 'attachment; filename="plain.txt"' } }));

    expect((await downloadWorkspaceFile('plain.txt', 'other.txt')).filename).toBe('plain.txt');
  });

  it('sends a write with the precondition header', async () => {
    fetchWithAuth.mockResolvedValue(response({ name: 'a.txt', path: 'a.txt', type: 'file', size: 1, mtime: 1 }));

    await writeWorkspaceFile('a.txt', 'x', 1_782_000_000);

    expect(fetchWithAuth.mock.calls[0][0]).toBe('/agent-api/workspace/file?path=a.txt');
    expect(fetchWithAuth.mock.calls[0][1]).toEqual({
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'If-Unmodified-Since': 'Sun, 21 Jun 2026 00:00:00 GMT' },
      body: 'x',
    });
  });

  it('deletes through the collection route', async () => {
    fetchWithAuth.mockResolvedValue(response({ path: 'docs', deleted: true }));

    await deleteWorkspaceEntry('docs');

    expect(fetchWithAuth.mock.calls[0][0]).toBe('/agent-api/workspace?path=docs');
    expect(fetchWithAuth.mock.calls[0][1]).toEqual({ method: 'DELETE' });
  });

  it('keeps the code and message of the failure', () => {
    const error = new WorkspaceApiError(413, 'FILE_TOO_LARGE', 'too big');

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('too big');
    expect(error.error).toEqual({ code: 'FILE_TOO_LARGE', message: 'too big' });
  });
});
