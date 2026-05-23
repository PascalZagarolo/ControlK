export type ExtractedMention = {
  type: 'customer' | 'contract' | 'vehicle' | 'channel' | 'event' | 'todo' | 'user';
  id: string;
  label: string;
  blockId?: string;
};

/**
 * Walks the BlockNote document JSON tree, collects all inline contents of
 * type 'mention'. The custom mention inline-content schema we register on
 * the editor stores:
 *   { type: 'mention', props: { kind, id, label } }
 *
 * BlockNote serializes blocks as { id, type, content[], children[], props }
 * where `content` can contain text runs OR inline custom content. We recurse
 * into children for nested blocks.
 */
export function extractMentions(document: unknown): ExtractedMention[] {
  const out: ExtractedMention[] = [];
  const seen = new Set<string>();

  function walk(node: any, parentBlockId?: string) {
    if (!node || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      for (const item of node) walk(item, parentBlockId);
      return;
    }

    const blockId: string | undefined = typeof node.id === 'string' ? node.id : parentBlockId;

    // Inline content with type === 'mention'
    if (node.type === 'mention' && node.props && typeof node.props === 'object') {
      const kind = node.props.kind;
      const id = node.props.id;
      const label = node.props.label ?? '';
      if (
        typeof kind === 'string' &&
        typeof id === 'string' &&
        ['customer', 'contract', 'vehicle', 'channel', 'event', 'todo', 'user'].includes(kind)
      ) {
        const key = `${kind}:${id}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ type: kind as any, id, label: String(label), blockId });
        }
      }
    }

    // Recurse into known nested shapes
    if (Array.isArray(node.content)) walk(node.content, blockId);
    if (Array.isArray(node.children)) walk(node.children, blockId);
  }

  walk(document);
  return out;
}
