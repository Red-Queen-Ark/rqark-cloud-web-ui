/** The `@` token that ends at the caret. */
export interface MentionQuery {
  /** The text after the `@`, i.e. what narrows the list. */
  query: string;
  /** Offset of the `@` in the text before the caret. */
  start: number;
}

/**
 * Finds the `@` token ending at the caret, or null when there is none.
 *
 * The marker must open a word ("mail@example" is not a mention) and the token
 * must not contain whitespace, so a mention ends as soon as the user types a
 * space after the path.
 */
export function mentionQuery(textBeforeCaret: string): MentionQuery | null {
  const at = textBeforeCaret.lastIndexOf('@');
  if (at < 0) {
    return null;
  }
  if (at > 0 && !/\s/.test(textBeforeCaret[at - 1])) {
    return null;
  }
  const query = textBeforeCaret.slice(at + 1);
  if (/\s/.test(query)) {
    return null;
  }
  return { query, start: at };
}
