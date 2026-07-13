import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { useStore } from '../../store/useStore';
import type { NoteMentionOptions } from '../../lib/extensions/noteMention';

/* Puce affichée dans le texte pour une mention "@compétence" — résout le nom
   en direct depuis le store (toujours à jour), navigue au clic. */
export default function MentionChip({ node, extension }: ReactNodeViewProps) {
  const { treeId, nodeId } = node.attrs as { treeId: string; nodeId: string };
  const trees = useStore((s) => s.trees);
  const tree = trees.find((t) => t.id === treeId);
  const target = tree?.nodes.find((n) => n.id === nodeId);
  const missing = !target;
  const label = target ? (target.name || 'Sans titre') : 'Compétence supprimée';

  const { onNavigate } = extension.options as NoteMentionOptions;

  return (
    <NodeViewWrapper as="span" className={`note-mention${missing ? ' missing' : ''}`} contentEditable={false}>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => { if (target) onNavigate(treeId, nodeId); }}
        title={missing ? label : `${tree!.name || 'Sans titre'} — ${label}`}
        disabled={missing}
      >
        ◆ {label}
      </button>
    </NodeViewWrapper>
  );
}
