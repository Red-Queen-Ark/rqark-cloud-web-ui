import DOMPurify from 'dompurify';
import { Marked } from 'marked';

/**
 * Markdown rendering for model-authored text.
 *
 * `marked` says of itself that it "does not sanitize the output HTML", and the
 * text here is written by a model, so every render is passed through DOMPurify
 * before it can reach `v-html`. That is the reason this helper exists at all:
 * nothing in the app should call `marked` directly.
 *
 * The instance is local rather than the global `marked` singleton so the GFM and
 * line-break choices below cannot be changed from somewhere else.
 */
const marked = new Marked({
  gfm: true,
  // A chat message treats a single newline as a line break; without this the
  // CommonMark rule would join the lines into one paragraph.
  breaks: true,
});

/** Renders markdown to HTML that is safe to bind with `v-html`. */
export function renderMarkdown(source?: string | null): string {
  if (!source) {
    return '';
  }

  // `async: false` keeps `parse` synchronous, which is what the template needs.
  const html = marked.parse(source, { async: false });

  return DOMPurify.sanitize(html);
}
