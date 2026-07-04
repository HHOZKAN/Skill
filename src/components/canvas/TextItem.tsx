import { useEffect, useRef } from 'react';
import { useEditor, EditorContent, type Editor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle, Color, FontSize } from '@tiptap/extension-text-style';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import { Callout } from '../../lib/extensions/callout';
import { SlashCommand } from '../../lib/extensions/slashCommand';
import type { CanvasTextItem } from '../../types';

const lowlight = createLowlight(common);
const DRAG_THRESHOLD = 4;

interface Props {
  item: CanvasTextItem;
  selected: boolean;
  zoom: number;
  onSelect: () => void;
  onChange: (patch: Partial<CanvasTextItem>) => void;
  onDelete: () => void;
  onEditorReady: (editor: Editor | null) => void;
}

export default function TextItem({ item, selected, zoom, onSelect, onChange, onDelete, onEditorReady }: Props) {
  const lastContent = useRef(item.content);

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
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      FontSize,
      CodeBlockLowlight.configure({ lowlight }),
      Callout,
      SlashCommand,
    ],
    content: item.content,
    autofocus: false,
    editorProps: { attributes: { class: 'tiptap-editor' } },
    onUpdate: ({ editor }) => {
      /* On mémorise ce qu'on envoie : quand la prop revient identique,
         l'effet ci-dessous ne doit PAS réinitialiser le document
         (sinon le caret saute et la sélection est perdue à chaque frappe) */
      const json = editor.getJSON() as JSONContent;
      lastContent.current = json;
      onChange({ content: json });
    },
  });

  /* setContent uniquement pour un vrai changement externe (migration, reset…) */
  useEffect(() => {
    if (!editor) return;
    if (item.content !== lastContent.current) {
      lastContent.current = item.content;
      editor.commands.setContent(item.content, { emitUpdate: false });
    }
  }, [editor, item.content]);

  /* Expose l'éditeur au canvas pour la barre de format fixe */
  const onEditorReadyRef = useRef(onEditorReady);
  useEffect(() => { onEditorReadyRef.current = onEditorReady; }, [onEditorReady]);
  useEffect(() => {
    onEditorReadyRef.current(editor ?? null);
    return () => onEditorReadyRef.current(null);
  }, [editor]);

  /* Suppr quand le bloc est sélectionné et qu'on n'est pas en train d'éditer */
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const active = document.activeElement as HTMLElement | null;
      const insideMe = active && active.closest?.(`[data-item-id="${item.id}"]`);
      if (!insideMe) {
        e.preventDefault();
        onDelete();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, item.id, onDelete]);

  /* Mousedown : deux régimes.
     - Éditeur déjà focus (on est en train d'écrire) ⇒ la souris appartient à Tiptap :
       glisser sélectionne du texte, on ne déplace PAS le bloc.
     - Éditeur pas focus ⇒ maintenir + bouger déplace le bloc ;
       relâcher sans bouger = clic normal qui entre en édition (caret placé). */
  const onItemMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect();
    if (editor?.isFocused) return;
    const startX = e.clientX, startY = e.clientY;
    const origin = { x: item.x, y: item.y };
    let dragging = false;
    const onMove = (ev: MouseEvent) => {
      if (!dragging) {
        if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) < DRAG_THRESHOLD) return;
        dragging = true;
        /* On déplace → on annule l'entrée en édition que le mousedown a amorcée */
        (document.activeElement as HTMLElement | null)?.blur?.();
      }
      onChange({
        x: origin.x + (ev.clientX - startX) / zoom,
        y: origin.y + (ev.clientY - startY) / zoom,
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  /* Redim : bord droit (largeur seule) + coin (largeur + hauteur) */
  const startResize = (e: React.MouseEvent, mode: 'w' | 'wh') => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const startW = item.w;
    const startH = item.h ?? (e.currentTarget as HTMLElement).closest('.canvas-text')!.getBoundingClientRect().height / zoom;
    const onMove = (ev: MouseEvent) => {
      const w = Math.max(140, startW + (ev.clientX - startX) / zoom);
      if (mode === 'w') {
        onChange({ w });
      } else {
        const h = Math.max(60, startH + (ev.clientY - startY) / zoom);
        onChange({ w, h });
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  /* Rotation libre : glisser une poignée fait tourner le post-it autour de son centre.
     Zone morte près du centre : un contrôle purement angulaire devient
     extrêmement sensible quand le curseur s'approche du pivot (la moindre
     bougeotte y produit des sauts d'angle énormes) ; en dessous de ce rayon
     on ignore le mouvement plutôt que de suivre un angle instable.
     Rotation libre et continue par défaut — Maj = magnétisme par 15°
     (aimanter par défaut provoquait des allers-retours quand la souris
     hésitait pile entre deux paliers, d'où l'effet "tourne n'importe comment"). */
  const ROTATE_DEAD_ZONE = 30;
  const ROTATE_SNAP = 15;
  const startRotate = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const el = (e.currentTarget as HTMLElement).closest('.canvas-text') as HTMLElement;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
    const baseRotate = item.rotate ?? 0;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - cx, dy = ev.clientY - cy;
      if (Math.hypot(dx, dy) < ROTATE_DEAD_ZONE) return;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      let next = baseRotate + (angle - startAngle);
      if (ev.shiftKey) next = Math.round(next / ROTATE_SNAP) * ROTATE_SNAP;
      onChange({ rotate: next });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div
      data-item-id={item.id}
      className={`canvas-text${selected ? ' selected' : ''}${item.bg ? ' sticky' : ''}`}
      style={{
        position: 'absolute',
        left: item.x,
        top: item.y,
        width: item.w,
        height: item.h,
        background: item.bg || undefined,
        transform: item.bg ? `rotate(${item.rotate ?? 0}deg)` : undefined,
      }}
      onMouseDown={onItemMouseDown}
    >
      <EditorContent editor={editor} />

      {selected && (
        <>
          <span
            className="canvas-text-resize edge"
            onMouseDown={(e) => startResize(e, 'w')}
            style={{ transform: `scaleX(${1 / zoom})`, transformOrigin: 'right center' }}
            title="Redimensionner en largeur"
          />
          <span
            className="canvas-text-resize corner"
            onMouseDown={(e) => startResize(e, 'wh')}
            style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'bottom right' }}
            title="Redimensionner la zone"
          />

          {/* poignées de rotation dans les 4 coins — uniquement sur un post-it, tournent avec lui */}
          {item.bg && (
            <>
              <span
                className="canvas-text-rotate-corner tl"
                onMouseDown={startRotate}
                style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'top left' }}
                title="Faire pivoter (Maj = par paliers de 15°)"
              />
              <span
                className="canvas-text-rotate-corner tr"
                onMouseDown={startRotate}
                style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'top right' }}
                title="Faire pivoter (Maj = par paliers de 15°)"
              />
              <span
                className="canvas-text-rotate-corner bl"
                onMouseDown={startRotate}
                style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'bottom left' }}
                title="Faire pivoter (Maj = par paliers de 15°)"
              />
              <span
                className="canvas-text-rotate-corner br"
                onMouseDown={startRotate}
                style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'bottom right' }}
                title="Faire pivoter (Maj = par paliers de 15°)"
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
