import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { IBack } from './Icons';
import NoteCanvas from './canvas/NoteCanvas';
import { getOrMigrateCanvas } from '../lib/canvas';
import type { Tree, ConstellationNode, NoteData, NoteCanvas as NoteCanvasData } from '../types';

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
  onNavigateToNote: (treeId: string, nodeId: string) => void;
}

export default function NotesPage({ tree, node, onBack, onSave, onRename, onNavigateToNote }: Props) {
  const initialCanvas = getOrMigrateCanvas(tree.notes?.[node.id]);

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

  const handleCanvasChange = (next: NoteCanvasData) => {
    onSaveRef.current(node.id, { canvas: next });
  };

  /* Repingle l'ancêtre .sky : évite qu'un focus du contenteditable décale le header */
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sky = rootRef.current?.closest('.sky') as HTMLElement | null;
    if (!sky) return;
    sky.scrollTop = 0;
    const pin = () => { if (sky.scrollTop) sky.scrollTop = 0; };
    sky.addEventListener('scroll', pin);
    return () => sky.removeEventListener('scroll', pin);
  }, []);

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

  return (
    <div className="notes-editor canvas-mode" ref={rootRef}>
      <div className="note-header">
        <motion.button className="note-back" title="Retour" onClick={onBack} whileTap={{ scale: 0.93 }}>
          <IBack size={16} />
        </motion.button>

        <div className="note-node">
          <span className={`dot ${node.state}`} />
          <span className="note-node-name">{node.name || 'Sans nom'}</span>
          <span className={`note-state-badge ${node.state}`}>{STATE_LABEL[node.state]}</span>
        </div>
      </div>

      <div className="note-title-strip">
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
        />
      </div>

      <NoteCanvas
        initial={initialCanvas}
        onChange={handleCanvasChange}
        treeId={tree.id}
        nodeId={node.id}
        onNavigateToNote={onNavigateToNote}
      />

      <div className="note-footer">
        <kbd>V</kbd> sélection · <kbd>T</kbd> texte · <kbd>B</kbd> plume · <kbd>E</kbd> gomme · <kbd>R</kbd> relier · <kbd>F</kbd> cadre · <kbd>S</kbd> formes · drop/colle une image · <kbd>Espace</kbd>+glisser pan · <kbd>Ctrl</kbd>+molette zoom · <kbd>Échap</kbd> retour
      </div>
    </div>
  );
}
