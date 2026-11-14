import { describe, expect, it } from 'vitest';
import { basename, checkProjectName, checkProjectPath, projectPathLabel } from './projects';

describe('checkProjectPath', () => {
  it('keeps a relative path and collapses its separators', () => {
    expect(checkProjectPath('acme/api')).toEqual({ ok: true, path: 'acme/api' });
    expect(checkProjectPath('  acme//api/ ')).toEqual({ ok: true, path: 'acme/api' });
    expect(checkProjectPath('acme/./api')).toEqual({ ok: true, path: 'acme/api' });
  });

  it('refuses a path that cannot name a folder inside the volume', () => {
    expect(checkProjectPath('').error).toBe('pathRequired');
    expect(checkProjectPath('   ').error).toBe('pathRequired');
    expect(checkProjectPath('/workspace/acme').error).toBe('pathNoLeadingSlash');
    expect(checkProjectPath('acme\\api').error).toBe('pathNoBackslash');
    expect(checkProjectPath('../acme').error).toBe('pathNoParent');
    expect(checkProjectPath('acme/../../etc').error).toBe('pathNoParent');
    expect(checkProjectPath('///').error).toBe('pathNoLeadingSlash');
  });
});

describe('checkProjectName', () => {
  it('trims the name', () => {
    expect(checkProjectName('  Acme API ')).toEqual({ ok: true, name: 'Acme API' });
  });

  it('refuses an empty, control-bearing or over-long name', () => {
    expect(checkProjectName('').error).toBe('nameRequired');
    expect(checkProjectName('   ').error).toBe('nameRequired');
    expect(checkProjectName('acme\u0001api').error).toBe('nameInvalid');
    expect(checkProjectName('a'.repeat(65)).error).toBe('nameTooLong');
  });

  it('counts characters rather than bytes', () => {
    expect(checkProjectName('項'.repeat(64)).ok).toBe(true);
  });
});

describe('projectPathLabel', () => {
  it('spells the path the way the sandbox sees it', () => {
    expect(projectPathLabel('acme/api')).toBe('/workspace/acme/api');
    expect(projectPathLabel('')).toBe('/workspace');
    expect(projectPathLabel(undefined)).toBe('/workspace');
  });
});

describe('basename', () => {
  it('is the last segment of the path', () => {
    expect(basename('acme/api')).toBe('api');
    expect(basename('acme')).toBe('acme');
    expect(basename('')).toBe('');
  });
});
