import { useEffect, useRef } from 'react';
import { useEditor, EditorContent, type Editor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle, Color, FontSize } from '@tiptap/extension-text-style';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { createLowlight } from 'lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import sql from 'highlight.js/lib/languages/sql';
import markdown from 'highlight.js/lib/languages/markdown';
import rust from 'highlight.js/lib/languages/rust';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import { Callout } from '../../lib/extensions/callout';
import { SlashCommand } from '../../lib/extensions/slashCommand';
import { NoteMention } from '../../lib/extensions/noteMention';
import { extractYouTubeId, getUrlDomain, PACER_INFO } from '../../lib/canvas';
import type { CanvasTextItem } from '../../types';

/* Sélection ciblée de langages plutôt que le preset `common` (~37 langages) :
   allège nettement le chunk de la page de notes. */
const lowlight = createLowlight({
  javascript, typescript, python, bash, json, xml, css, sql, markdown, rust, go, java,
});
const DRAG_THRESHOLD = 4;

interface Props {
  item: CanvasTextItem;
  selected: boolean;
  zoom: number;
  onSelect: () => void;
  onChange: (patch: Partial<CanvasTextItem>) => void;
  onDelete: () => void;
  onEditorReady: (editor: Editor | null) => void;
  linking?: boolean;
  isLinkSource?: boolean;
  onLinkPick?: () => void;
  onNavigateToNote: (treeId: string, nodeId: string) => void;
  onDragTo: (x: number, y: number) => void;
  onDragEnd: () => void;
}

export default function TextItem({ item, selected, zoom, onSelect, onChange, onDelete, onEditorReady, linking, isLinkSource, onLinkPick, onNavigateToNote, onDragTo, onDragEnd }: Props) {
  const lastContent = useRef(item.content);
  const youtubeId = item.link ? extractYouTubeId(item.link) : null;
  const rootRef = useRef<HTMLDivElement>(null);

  /* La liste d'extensions n'est lue qu'à la création de l'éditeur (Tiptap ne
     la remet pas à jour à chaque rendu) : on passe par une ref pour que la
     mention navigue toujours avec le callback le plus récent. */
  const onNavigateRef = useRef(onNavigateToNote);
  useEffect(() => { onNavigateRef.current = onNavigateToNote; }, [onNavigateToNote]);

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
      // eslint-disable-next-line react-hooks/refs -- lu seulement au clic sur la puce, jamais pendant ce rendu
      NoteMention.configure({
        onNavigate: (treeId, nodeId) => onNavigateRef.current(treeId, nodeId),
      }),
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

  /* Taille automatique : le bloc mesure son propre rendu et resynchronise w/h
     stockés (utiles aux guides d'alignement, connecteurs, cadres…), plutôt
     que d'imposer une largeur/hauteur figée. */
  useEffect(() => {
    if (!item.autoWidth && !item.autoHeight) return;
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const patch: Partial<CanvasTextItem> = {};
      if (item.autoWidth) patch.w = el.offsetWidth;
      if (item.autoHeight) patch.h = el.offsetHeight;
      onChange(patch);
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.autoWidth, item.autoHeight]);

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
    if (linking) { onLinkPick?.(); return; }
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
      onDragTo(
        origin.x + (ev.clientX - startX) / zoom,
        origin.y + (ev.clientY - startY) / zoom,
      );
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (dragging) onDragEnd();
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
        onChange({ w, autoWidth: false });
      } else {
        const h = Math.max(60, startH + (ev.clientY - startY) / zoom);
        onChange({ w, h, autoWidth: false, autoHeight: false });
      }
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
      ref={rootRef}
      data-item-id={item.id}
      className={`canvas-text${selected ? ' selected' : ''}${item.bg ? ' sticky' : ''}${isLinkSource ? ' link-source' : ''}${item.autoWidth ? ' auto-w' : ''}${item.autoHeight ? ' auto-h' : ''}`}
      style={{
        position: 'absolute',
        left: item.x,
        top: item.y,
        width: item.autoWidth ? undefined : item.w,
        height: item.autoHeight ? undefined : item.h,
        background: item.bg || undefined,
        transform: item.bg ? `rotate(${item.rotate ?? 0}deg)` : undefined,
      }}
      onMouseDown={onItemMouseDown}
    >
      {item.pacer && (
        <span
          className="canvas-pacer-badge"
          style={{ background: PACER_INFO[item.pacer].color }}
          title={`${PACER_INFO[item.pacer].label} — ${PACER_INFO[item.pacer].hint}`}
        >
          {item.pacer}
        </span>
      )}
      {item.link && (
        <div className="canvas-link-embed" onMouseDown={(e) => e.stopPropagation()}>
          {youtubeId ? (
            <div className="cle-video">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
                title="Vidéo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <a className="cle-link" href={item.link} target="_blank" rel="noopener noreferrer">
              <span className="cle-domain">{getUrlDomain(item.link)}</span>
              <span className="cle-url">{item.link}</span>
            </a>
          )}
          <button
            type="button"
            className="cle-remove"
            title="Retirer le lien"
            onClick={() => onChange({ link: null })}
          >
            ✕
          </button>
        </div>
      )}
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
        </>
      )}
    </div>
  );
}
