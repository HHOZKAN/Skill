import { useRef, useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';

type Align = 'float-left' | 'center' | 'float-right' | 'full';

const ALIGNS: { key: Align; title: string }[] = [
  { key: 'float-left', title: 'Habillage à gauche' },
  { key: 'center', title: 'Centrer' },
  { key: 'float-right', title: 'Habillage à droite' },
  { key: 'full', title: 'Pleine largeur' },
];

function AlignIcon({ t }: { t: Align }) {
  const line = (x: number, y: number, w: number) => (
    <rect x={x} y={y} width={w} height="1.6" rx="0.8" fill="currentColor" opacity="0.5" />
  );
  if (t === 'full')
    return (
      <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden>
        <rect x="2" y="3" width="18" height="10" rx="1.5" fill="currentColor" />
      </svg>
    );
  if (t === 'center')
    return (
      <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden>
        {line(3, 3, 16)}
        <rect x="6" y="6" width="10" height="6" rx="1.2" fill="currentColor" />
      </svg>
    );
  if (t === 'float-left')
    return (
      <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden>
        <rect x="2" y="3" width="8" height="10" rx="1.2" fill="currentColor" />
        {line(12, 4, 8)}
        {line(12, 8, 7)}
        {line(12, 12, 8)}
      </svg>
    );
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden>
      <rect x="12" y="3" width="8" height="10" rx="1.2" fill="currentColor" />
      {line(2, 4, 8)}
      {line(3, 8, 7)}
      {line(2, 12, 8)}
    </svg>
  );
}

export default function ImageView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const { src, alt, width, align } = node.attrs as {
    src: string;
    alt: string | null;
    width: number | null;
    align: Align;
  };
  const imgRef = useRef<HTMLImageElement>(null);
  const [dragging, setDragging] = useState(false);
  const editable = editor.isEditable;

  const startResize = (e: React.MouseEvent, side: 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = imgRef.current?.offsetWidth ?? 0;
    const page = imgRef.current?.closest('.tiptap-editor') as HTMLElement | null;
    const maxW = page ? page.clientWidth : 9999;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const delta = side === 'right' ? dx : -dx;
      const w = Math.max(80, Math.min(maxW, Math.round(startW + delta)));
      updateAttributes({ width: w });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  /* glisser l'image vers un bord → habillage gauche/droite, le texte s'enroule */
  const startReposition = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    if (typeof getPos === 'function') {
      const pos = getPos();
      if (typeof pos === 'number') editor.commands.setNodeSelection(pos);
    }
    const page = imgRef.current?.closest('.tiptap-editor') as HTMLElement | null;
    if (!page) return;
    const rect = page.getBoundingClientRect();
    let last: Align = align;
    let moved = false;
    const zoneFor = (clientX: number): Align => {
      const x = (clientX - rect.left) / rect.width;
      if (x < 0.34) return 'float-left';
      if (x > 0.66) return 'float-right';
      return 'center';
    };
    const onMove = (ev: MouseEvent) => {
      if (!moved) {
        moved = true;
        setDragging(true);
      }
      const z = zoneFor(ev.clientX);
      if (z !== last) {
        last = z;
        updateAttributes({ align: z });
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDragging(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const showHandles = editable && selected && align !== 'full' && !dragging;

  return (
    <NodeViewWrapper className={`img-block align-${align}${selected ? ' selected' : ''}${dragging ? ' dragging' : ''}`}>
      <div
        className="img-frame"
        style={{ width: align === 'full' ? '100%' : width ? `${width}px` : undefined }}
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt ?? ''}
          draggable={false}
          onMouseDown={editable ? startReposition : undefined}
          style={{ cursor: editable ? 'grab' : 'default' }}
        />
        {showHandles && (
          <>
            <span className="img-resize left" onMouseDown={(e) => startResize(e, 'left')} />
            <span className="img-resize right" onMouseDown={(e) => startResize(e, 'right')} />
          </>
        )}
        {editable && selected && !dragging && (
          <div className="img-toolbar" contentEditable={false}>
            {ALIGNS.map((a) => (
              <button
                key={a.key}
                type="button"
                className={`img-al-btn${align === a.key ? ' active' : ''}`}
                title={a.title}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  updateAttributes({ align: a.key });
                }}
              >
                <AlignIcon t={a.key} />
              </button>
            ))}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
