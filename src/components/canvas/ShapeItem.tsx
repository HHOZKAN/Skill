import { useEffect } from 'react';
import type { CanvasShapeItem } from '../../types';

interface Props {
  item: CanvasShapeItem;
  selected: boolean;
  zoom: number;
  onSelect: () => void;
  onChange: (patch: Partial<CanvasShapeItem>) => void;
  onDelete: () => void;
  onDragTo: (x: number, y: number) => void;
  onDragEnd: () => void;
}

export default function ShapeItem({ item, selected, zoom, onSelect, onChange, onDelete, onDragTo, onDragEnd }: Props) {
  /* Suppr quand la forme est sélectionnée (focus hors champ texte) */
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const active = document.activeElement as HTMLElement | null;
      if (active && (active.isContentEditable || active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      onDelete();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, onDelete]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect();
    const startX = e.clientX, startY = e.clientY;
    const origin = { x: item.x, y: item.y };
    const move = (ev: MouseEvent) => {
      onDragTo(
        origin.x + (ev.clientX - startX) / zoom,
        origin.y + (ev.clientY - startY) / zoom,
      );
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      onDragEnd();
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  /* Redim libre (largeur/hauteur indépendantes) depuis le coin bas-droit */
  const startResize = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const startW = item.w, startH = item.h;
    const move = (ev: MouseEvent) => {
      const w = Math.max(30, startW + (ev.clientX - startX) / zoom);
      const h = Math.max(30, startH + (ev.clientY - startY) / zoom);
      onChange({ w, h });
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div
      data-item-id={item.id}
      className={`canvas-shape canvas-shape-${item.shape}${selected ? ' selected' : ''}`}
      style={{
        position: 'absolute',
        left: item.x,
        top: item.y,
        width: item.w,
        height: item.h,
        background: item.fill,
      }}
      onMouseDown={handleMouseDown}
    >
      {selected && (
        <span
          className="canvas-shape-resize"
          onMouseDown={startResize}
          style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'bottom right' }}
          title="Redimensionner"
        />
      )}
    </div>
  );
}
