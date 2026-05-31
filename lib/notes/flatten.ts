/**
 * Flatten a BlockNote/Tiptap-style jsonb document to plain text. Shared by
 * the AI action-item extractor and the full-text search-index maintenance
 * (notes.search_text). Walks `content` (inline) and `children` (nested
 * blocks) recursively.
 */
export function flattenNoteText(node: any): string {
  if (node == null) return '';
  if (Array.isArray(node)) return node.map(flattenNoteText).join('\n');
  let out = '';
  if (typeof node.text === 'string') out += node.text;
  if (Array.isArray(node.content)) out += node.content.map(flattenNoteText).join('');
  if (Array.isArray(node.children)) out += '\n' + node.children.map(flattenNoteText).join('\n');
  return out;
}

/** Normalized, length-capped search text for the notes.search_text column. */
export function noteSearchText(document: unknown): string {
  return flattenNoteText(document).replace(/\s+/g, ' ').trim().slice(0, 20_000);
}
