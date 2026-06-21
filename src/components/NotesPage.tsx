import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useEditor, EditorContent, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { ResizableImage } from '../lib/extensions/resizableImage';
import Highlight from '@tiptap/extension-highlight';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import { IBack, IUndo } from './Icons';
import { Callout } from '../lib/extensions/callout';
import { SlashCommand } from '../lib/extensions/slashCommand';
import BubbleMenuBar from './BubbleMenuBar';
import BlockHandle from './BlockHandle';
import Toc from './Toc';
import type { Tree, ConstellationNode, NoteData } from '../types';

const lowlight = createLowlight(common);

const STATE_LABEL: Record<ConstellationNode['state'], string> = {
  todo: 'À commencer',
  doing: 'En cours',
  done: 'Maîtrisée',
};

interface Props {
  tree: Tree;
  node: ConstellationNode;
  onBack: () => void;
  onSave: (nodeId: string, data: NoteData) => void;
  onRename: (nodeId: string, name: string) => void;
}

export default function NotesPage({ tree, node, onBack, onSave, onRename }: Props) {
  const initialContent = tree.notes?.[node.id]?.content ?? '';

  const onSaveRef = useRef(onSave);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

  const [title, setTitle] = useState(node.name);
  useEffect(() => { setTitle(node.name); }, [node.id, node.name]);

  const titleRef = useRef<HTMLTextAreaElement>(null);
  const renameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const el = titleRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }
  }, [title]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = (json: JSONContent) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onSaveRef.current(node.id, { content: json }), 400);
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } },
      }),
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === 'heading' ? 'Titre…' : 'Tape "/" pour insérer un bloc…',
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      ResizableImage.configure({ inline: false }),
      Highlight.configure({ multicolor: true }),
      CodeBlockLowlight.configure({ lowlight }),
      Callout,
      SlashCommand,
    ],
    content: initialContent,
    autofocus: false,
    editorProps: {
      attributes: { class: 'tiptap-editor' },
    },
    onUpdate: ({ editor }) => persist(editor.getJSON()),
  });

  /* focus sans décaler le conteneur parent (sinon le header sombre se retrouve masqué).
     L'ancêtre .sky (overflow:hidden) peut être défilé par le focus du contenteditable ;
     on le repingle à 0 tant que l'éditeur est ouvert. */
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!editor) return;
    editor.commands.focus('end', { scrollIntoView: false });
    const sky = rootRef.current?.closest('.sky') as HTMLElement | null;
    if (!sky) return;
    sky.scrollTop = 0;
    const pin = () => { if (sky.scrollTop) sky.scrollTop = 0; };
    sky.addEventListener('scroll', pin);
    return () => sky.removeEventListener('scroll', pin);
  }, [editor]);

  /* Échap → retour (sauf si le menu slash est ouvert) */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('.slash-popup')) return;
      onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  /* flush la sauvegarde au démontage */
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        if (editor) onSaveRef.current(node.id, { content: editor.getJSON() });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  return (
    <div className="notes-editor" ref={rootRef}>
      <div className="note-header">
        <motion.button className="note-back" title="Retour" onClick={onBack} whileTap={{ scale: 0.93 }}>
          <IBack size={16} />
        </motion.button>

        <div className="note-node">
          <span className={`dot ${node.state}`} />
          <span className="note-node-name">{node.name || 'Sans nom'}</span>
          <span className={`note-state-badge ${node.state}`}>{STATE_LABEL[node.state]}</span>
        </div>

        <div className="note-header-actions">
          <button
            type="button"
            className="note-h-btn"
            title="Annuler (Ctrl+Z)"
            onClick={() => editor?.chain().focus().undo().run()}
          >
            <IUndo size={14} />
          </button>
        </div>
      </div>

      <div className="editor-scroll">
        {editor && <Toc editor={editor} />}
        <div className="editor-page">
          <textarea
            ref={titleRef}
            className="note-title-input"
            value={title}
            rows={1}
            placeholder="Sans titre"
            spellCheck={false}
            onChange={(e) => {
              setTitle(e.target.value);
              if (renameTimer.current) clearTimeout(renameTimer.current);
              const v = e.target.value;
              renameTimer.current = setTimeout(() => onRename(node.id, v), 300);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'ArrowDown') {
                e.preventDefault();
                editor?.commands.focus('start');
              }
            }}
          />
          {editor && <BubbleMenuBar editor={editor} />}
          {editor && <BlockHandle editor={editor} />}
          <EditorContent editor={editor} />
        </div>
      </div>

      <div className="note-footer">
        Tape <kbd>/</kbd> pour insérer un bloc · <kbd>Ctrl+Z</kbd> annuler · <kbd>Échap</kbd> retour
      </div>
    </div>
  );
}
