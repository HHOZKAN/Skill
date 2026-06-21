import { BubbleMenu } from '@tiptap/react/menus';
import { useEditorState, type Editor } from '@tiptap/react';
import { ILink } from './Icons';

interface Props {
  editor: Editor;
}

const HIGHLIGHTS = [
  { color: '#fef08a', title: 'Jaune' },
  { color: '#bbf7d0', title: 'Vert' },
  { color: '#bfdbfe', title: 'Bleu' },
  { color: '#fbcfe8', title: 'Rose' },
];

export default function BubbleMenuBar({ editor }: Props) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      code: editor.isActive('code'),
      h1: editor.isActive('heading', { level: 1 }),
      h2: editor.isActive('heading', { level: 2 }),
      link: editor.isActive('link'),
      highlightColor: editor.isActive('highlight')
        ? (editor.getAttributes('highlight').color as string | undefined)
        : undefined,
    }),
  });

  const run = (e: React.MouseEvent, fn: () => void) => {
    e.preventDefault();
    fn();
  };

  const toggleLink = () => {
    if (state.link) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const prev = (editor.getAttributes('link').href as string) || '';
    const url = window.prompt('Adresse du lien', prev);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const toggleHighlight = (color: string) => {
    if (state.highlightColor === color) {
      editor.chain().focus().unsetHighlight().run();
    } else {
      editor.chain().focus().setHighlight({ color }).run();
    }
  };

  return (
    <BubbleMenu
      editor={editor}
      className="bubble-menu"
      shouldShow={({ editor, from, to }) => {
        if (from === to) return false;
        if (editor.isActive('codeBlock') || editor.isActive('image')) return false;
        return true;
      }}
    >
      <button
        type="button"
        className={`bm-btn${state.bold ? ' active' : ''}`}
        title="Gras"
        onMouseDown={(e) => run(e, () => editor.chain().focus().toggleBold().run())}
      >
        <b>B</b>
      </button>
      <button
        type="button"
        className={`bm-btn${state.italic ? ' active' : ''}`}
        title="Italique"
        onMouseDown={(e) => run(e, () => editor.chain().focus().toggleItalic().run())}
      >
        <i>I</i>
      </button>
      <button
        type="button"
        className={`bm-btn${state.underline ? ' active' : ''}`}
        title="Souligné"
        onMouseDown={(e) => run(e, () => editor.chain().focus().toggleUnderline().run())}
      >
        <u>U</u>
      </button>

      <span className="bm-sep" />

      <button
        type="button"
        className={`bm-btn${state.code ? ' active' : ''}`}
        title="Code en ligne"
        onMouseDown={(e) => run(e, () => editor.chain().focus().toggleCode().run())}
      >
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{'</>'}</span>
      </button>
      <button
        type="button"
        className={`bm-btn${state.link ? ' active' : ''}`}
        title="Lien"
        onMouseDown={(e) => run(e, toggleLink)}
      >
        <ILink size={14} />
      </button>

      <span className="bm-sep" />

      {HIGHLIGHTS.map((h) => (
        <button
          key={h.color}
          type="button"
          className={`bm-hl${state.highlightColor === h.color ? ' active' : ''}`}
          title={`Surligner — ${h.title}`}
          style={{ background: h.color }}
          onMouseDown={(e) => run(e, () => toggleHighlight(h.color))}
        />
      ))}

      <span className="bm-sep" />

      <button
        type="button"
        className={`bm-btn${state.h1 ? ' active' : ''}`}
        title="Titre"
        onMouseDown={(e) => run(e, () => editor.chain().focus().toggleHeading({ level: 1 }).run())}
      >
        H1
      </button>
      <button
        type="button"
        className={`bm-btn${state.h2 ? ' active' : ''}`}
        title="Sous-titre"
        onMouseDown={(e) => run(e, () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
      >
        H2
      </button>
    </BubbleMenu>
  );
}
