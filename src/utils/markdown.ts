import DOMPurify from 'dompurify';
import { marked } from 'marked';

/**
 * Markdown rendering for model-authored text.
 *
 * `marked` says of itself that it "does not sanitize the output HTML", and the
 * text here is written by a model, so every render is passed through DOMPurify
 * before it can reach `v-html`. That is the reason this helper exists at all:
 * nothing in the app should call `marked` directly.
 */

/** Renders markdown to HTML that is safe to bind with `v-html`. */
export function renderMarkdown(source?: string | null): string {
  if (!source) {
    return '';
  }

  return DOMPurify.sanitize(marked.parse(source) as string);
}
