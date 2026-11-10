import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders the markdown a message is likely to carry', () => {
    expect(renderMarkdown('**bold**')).toBe('<p><strong>bold</strong></p>\n');
    expect(renderMarkdown('- one\n- two')).toBe('<ul>\n<li>one</li>\n<li>two</li>\n</ul>\n');
    expect(renderMarkdown('`code`')).toBe('<p><code>code</code></p>\n');
  });

  it('renders a single newline as a line break', () => {
    expect(renderMarkdown('first\nsecond')).toBe('<p>first<br>second</p>\n');
  });

  it('renders GFM tables', () => {
    const html = renderMarkdown('| a | b |\n| - | - |\n| 1 | 2 |');
    expect(html).toContain('<table>');
    expect(html).toContain('<td>1</td>');
  });

  it('escapes a fenced code block rather than parsing it', () => {
    const html = renderMarkdown('```\n<script>alert(1)</script>\n```');
    expect(html).toContain('<pre>');
    expect(html).not.toContain('<script>');
  });

  describe('sanitising', () => {
    it('drops a script tag and its body', () => {
      expect(renderMarkdown('<script>alert(1)</script>')).not.toContain('alert(1)');
    });

    it('drops an event handler attribute', () => {
      const html = renderMarkdown('<img src="x" onerror="alert(1)">');
      expect(html).not.toContain('onerror');
      expect(html).not.toContain('alert(1)');
    });

    it('drops a javascript: link', () => {
      const html = renderMarkdown('[click](javascript:alert(1))');
      expect(html).not.toContain('javascript:');
    });

    it('keeps an ordinary link', () => {
      const html = renderMarkdown('[docs](https://example.com/page)');
      expect(html).toContain('href="https://example.com/page"');
    });
  });

  it.each([undefined, null, ''])('returns an empty string for %s', (value) => {
    expect(renderMarkdown(value)).toBe('');
  });
});
