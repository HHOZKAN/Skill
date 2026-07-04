import { useEffect } from 'react';
import type { CanvasImageItem } from '../../types';

interface Props {
  item: CanvasImageItem;
  selected: boolean;
  zoom: number;
  onSelect: () => void;
  onChange: (patch: Partial<CanvasImageItem>) => void;
  onDelete: () => void;
}

export default function ImageItem({
  item, selected, zoom, onSelect, onChange, onDelete,
}: Props) {
  /* Suppr quand image sélectionnée (focus hors champ texte) */
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
      onChange({
        x: origin.x + (ev.clientX - startX) / zoom,
        y: origin.y + (ev.clientY - startY) / zoom,
      });
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  /* Resize avec respect du ratio depuis le coin bas-droite */
  const startResize = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const startW = item.w, startH = item.h;
    const ratio = startH / startW;
    const move = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      /* On suit la plus grande variation pour rester fluide */
      const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy / ratio;
      const w = Math.max(40, startW + delta);
      const h = Math.max(40, w * ratio);
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
      className={`canvas-image${selected ? ' selected' : ''}`}
      style={{
        position: 'absolute',
        left: item.x,
        top: item.y,
        width: item.w,
        height: item.h,
      }}
      onMouseDown={handleMouseDown}
    >
      <img src={item.src} alt={item.alt ?? ''} draggable={false} />
      {selected && (
        <span
          className="canvas-image-resize"
          onMouseDown={startResize}
          style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'bottom right' }}
          title="Redimensionner"
        />
      )}
    </div>
  );
}
