import { useEffect, useRef, useState } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import { ILink } from '../Icons';

const HIGHLIGHTS = [
  { color: '#fef08a', title: 'Jaune' },
  { color: '#bbf7d0', title: 'Vert' },
  { color: '#bfdbfe', title: 'Bleu' },
  { color: '#fbcfe8', title: 'Rose' },
];

const TEXT_COLORS = [
  { color: '#0f172a', title: 'Noir' },
  { color: '#dc2626', title: 'Rouge' },
  { color: '#2563eb', title: 'Bleu' },
  { color: '#16a34a', title: 'Vert' },
  { color: '#d97706', title: 'Orange' },
  { color: '#9333ea', title: 'Violet' },
];

interface Props {
  editor: Editor;
}

export default function TextFormatBar({ editor }: Props) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      p: editor.isActive('paragraph'),
      h1: editor.isActive('heading', { level: 1 }),
      h2: editor.isActive('heading', { level: 2 }),
      h3: editor.isActive('heading', { level: 3 }),
      ul: editor.isActive('bulletList'),
      ol: editor.isActive('orderedList'),
      task: editor.isActive('taskList'),
      bq: editor.isActive('blockquote'),
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      strike: editor.isActive('strike'),
      code: editor.isActive('code'),
      link: editor.isActive('link'),
      highlightColor: editor.isActive('highlight')
        ? (editor.getAttributes('highlight').color as string | undefined)
        : undefined,
      textColor: editor.getAttributes('textStyle').color as string | undefined,
      fontSize: editor.getAttributes('textStyle').fontSize as string | undefined,
    }),
  });

  /* --- taille en chiffres, appliquée à la sélection --- */
  const parsedSize = state.fontSize ? parseInt(state.fontSize, 10) : NaN;
  const [sizeInput, setSizeInput] = useState<string>('');
  useEffect(() => {
    setSizeInput(Number.isFinite(parsedSize) ? String(parsedSize) : '');
  }, [parsedSize]);

  const applySize = (n: number) => {
    const v = Math.max(8, Math.min(120, Math.round(n)));
    editor.chain().focus().setFontSize(`${v}px`).run();
  };
  const stepSize = (delta: number) => {
    const cur = Number.isFinite(parsedSize) ? parsedSize : 15;
    applySize(cur + delta);
  };

  /* --- couleur libre du texte --- */
  const colorInputRef = useRef<HTMLInputElement>(null);

  /* onMouseDown + preventDefault : ne pas voler le focus / la sélection de l'éditeur */
  const run = (e: React.MouseEvent, fn: () => void) => {
    e.preventDefault();
    e.stopPropagation();
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

  const Btn = ({ on, onClick, title, children }: {
    on?: boolean; onClick: () => void; title: string; children: React.ReactNode;
  }) => (
    <button
      type="button"
      className={`fb-btn${on ? ' active' : ''}`}
      title={title}
      aria-label={title}
      onMouseDown={(e) => run(e, onClick)}
    >
      {children}
    </button>
  );

  return (
    <div className="canvas-format-bar" onMouseDown={(e) => e.stopPropagation()}>
      {/* type de bloc */}
      <div className="fb-group">
        <Btn on={state.p} title="Paragraphe" onClick={() => editor.chain().focus().setParagraph().run()}>¶</Btn>
        <Btn on={state.h1} title="Titre 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</Btn>
        <Btn on={state.h2} title="Titre 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Btn>
        <Btn on={state.h3} title="Titre 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</Btn>
      </div>

      <span className="fb-sep" />

      {/* marques */}
      <div className="fb-group">
        <Btn on={state.bold} title="Gras" onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></Btn>
        <Btn on={state.italic} title="Italique" onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></Btn>
        <Btn on={state.underline} title="Souligné" onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></Btn>
        <Btn on={state.strike} title="Barré" onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></Btn>
        <Btn on={state.code} title="Code en ligne" onClick={() => editor.chain().focus().toggleCode().run()}>
          <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{'</>'}</span>
        </Btn>
        <Btn on={state.link} title="Lien" onClick={toggleLink}><ILink size={13} /></Btn>
      </div>

      <span className="fb-sep" />

      {/* couleur du texte : présélections + pipette libre */}
      <div className="fb-group">
        {TEXT_COLORS.map((c) => (
          <button
            key={c.color}
            type="button"
            className={`fb-tc${state.textColor === c.color ? ' active' : ''}`}
            title={`Texte ${c.title}`}
            onMouseDown={(e) => run(e, () => {
              if (state.textColor === c.color) editor.chain().focus().unsetColor().run();
              else editor.chain().focus().setColor(c.color).run();
            })}
          >
            <span style={{ color: c.color }}>A</span>
          </button>
        ))}
        <button
          type="button"
          className="fb-tc fb-tc-custom"
          title="Couleur personnalisée"
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); colorInputRef.current?.click(); }}
        >
          <span style={{ color: state.textColor ?? '#374151' }}>A</span>
          <i className="fb-rainbow" />
        </button>
        <input
          ref={colorInputRef}
          type="color"
          className="fb-color-input"
          value={state.textColor ?? '#374151'}
          onChange={(ev) => editor.chain().focus().setColor(ev.target.value).run()}
          tabIndex={-1}
          aria-label="Couleur personnalisée du texte"
        />
      </div>

      <span className="fb-sep" />

      {/* surlignage */}
      <div className="fb-group">
        {HIGHLIGHTS.map((h) => (
          <button
            key={h.color}
            type="button"
            className={`fb-hl${state.highlightColor === h.color ? ' active' : ''}`}
            title={`Surligner — ${h.title}`}
            style={{ background: h.color }}
            onMouseDown={(e) => run(e, () => toggleHighlight(h.color))}
          />
        ))}
      </div>

      <span className="fb-sep" />

      {/* listes & citation */}
      <div className="fb-group">
        <Btn on={state.ul} title="Liste à puces" onClick={() => editor.chain().focus().toggleBulletList().run()}>•</Btn>
        <Btn on={state.ol} title="Liste numérotée" onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</Btn>
        <Btn on={state.task} title="Cases à cocher" onClick={() => editor.chain().focus().toggleTaskList().run()}>☑</Btn>
        <Btn on={state.bq} title="Citation" onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝</Btn>
      </div>

      <span className="fb-sep" />

      {/* taille en chiffres (px), appliquée à la sélection */}
      <div className="fb-group fb-fontsize">
        <button
          type="button"
          className="fb-btn"
          title="Réduire la taille"
          onMouseDown={(e) => run(e, () => stepSize(-1))}
        >
          −
        </button>
        <input
          type="text"
          inputMode="numeric"
          className="fb-size-input"
          value={sizeInput}
          placeholder="15"
          title="Taille du texte (px) — Entrée pour appliquer"
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(ev) => setSizeInput(ev.target.value.replace(/[^0-9]/g, ''))}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter') {
              const n = parseInt(sizeInput, 10);
              if (Number.isFinite(n)) applySize(n);
            }
            if (ev.key === 'ArrowUp') { ev.preventDefault(); stepSize(1); }
            if (ev.key === 'ArrowDown') { ev.preventDefault(); stepSize(-1); }
          }}
          onBlur={() => {
            const n = parseInt(sizeInput, 10);
            if (Number.isFinite(n) && n !== parsedSize) applySize(n);
          }}
        />
        <button
          type="button"
          className="fb-btn"
          title="Agrandir la taille"
          onMouseDown={(e) => run(e, () => stepSize(1))}
        >
          +
        </button>
      </div>
    </div>
  );
}
