import { describe, expect, it } from 'vitest';
import { breadcrumbOf, formatSize, httpDate, isSensitivePath, joinPath, parentOf, previewKind } from './workspace';

describe('workspace paths', () => {
  it('joins a directory and a name', () => {
    expect(joinPath('', 'a.txt')).toBe('a.txt');
    expect(joinPath('docs', 'a.txt')).toBe('docs/a.txt');
    expect(joinPath('/docs/', 'a.txt')).toBe('docs/a.txt');
  });

  it('walks back to the parent', () => {
    expect(parentOf('docs/a.txt')).toBe('docs');
    expect(parentOf('docs')).toBe('');
    expect(parentOf('')).toBe('');
  });

  it('builds breadcrumbs from the path', () => {
    expect(breadcrumbOf('')).toEqual([]);
    expect(breadcrumbOf('docs/api')).toEqual([
      { name: 'docs', path: 'docs' },
      { name: 'api', path: 'docs/api' },
    ]);
  });
});

describe('isSensitivePath', () => {
  it('flags credential files', () => {
    expect(isSensitivePath('.env')).toBe(true);
    expect(isSensitivePath('app/.env.local')).toBe(true);
    expect(isSensitivePath('.git/config')).toBe(true);
    expect(isSensitivePath('repos/x/.git/config')).toBe(true);
    expect(isSensitivePath('.npmrc')).toBe(true);
    expect(isSensitivePath('deploy/id_rsa')).toBe(true);
  });

  it('leaves ordinary files alone', () => {
    expect(isSensitivePath('README.md')).toBe(false);
    expect(isSensitivePath('src/config.ts')).toBe(false);
    expect(isSensitivePath('docs/.gitignore')).toBe(false);
  });
});

describe('previewKind', () => {
  it('classifies by extension', () => {
    expect(previewKind({ name: 'a.png' })).toBe('image');
    expect(previewKind({ name: 'a.svg' })).toBe('image');
    expect(previewKind({ name: 'a.pdf' })).toBe('pdf');
    expect(previewKind({ name: 'a.md' })).toBe('markdown');
    expect(previewKind({ name: 'a.py' })).toBe('text');
    expect(previewKind({ name: 'Dockerfile' })).toBe('text');
    expect(previewKind({ name: 'a.bin' })).toBe('binary');
  });
});

describe('formatting', () => {
  it('scales sizes', () => {
    expect(formatSize(0)).toBe('0 B');
    expect(formatSize(512)).toBe('512 B');
    expect(formatSize(1536)).toBe('1.5 KB');
    expect(formatSize(10 * 1024 * 1024)).toBe('10 MB');
  });

  it('writes an http date', () => {
    expect(httpDate(0)).toBe('Thu, 01 Jan 1970 00:00:00 GMT');
  });
});
