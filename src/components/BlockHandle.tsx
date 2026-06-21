import { useRef } from 'react';
import { DragHandle } from '@tiptap/extension-drag-handle-react';
import type { Editor } from '@tiptap/react';
import type { Node } from '@tiptap/pm/model';

interface Props {
  editor: Editor;
}

export default function BlockHandle({ editor }: Props) {
  const current = useRef<{ pos: number; node: Node | null }>({ pos: 0, node: null });

  const insertBelow = (e: React.MouseEvent) => {
    e.preventDefault();
    const { pos, node } = current.current;
    if (!node) return;
    const end = pos + node.nodeSize;
    editor
      .chain()
      .focus()
      .insertContentAt(end, { type: 'paragraph' })
      .setTextSelection(end + 1)
      .insertContent('/')
      .run();
  };

  return (
    <DragHandle
      editor={editor}
      className="block-handle"
      onNodeChange={({ node, pos }) => {
        current.current = { node, pos };
      }}
    >
      <div className="block-handle-row">
        <button
          type="button"
          className="bh-add"
          title="Insérer un bloc"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={insertBelow}
        >
          +
        </button>
        <span className="bh-grip" title="Glisser pour déplacer">⠿</span>
      </div>
    </DragHandle>
  );
}
