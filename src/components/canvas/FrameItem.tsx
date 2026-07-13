import type { CanvasFrameItem } from '../../types';

const HEADER_H = 34;

interface Props {
  item: CanvasFrameItem;
  selected: boolean;
  zoom: number;
  onSelect: () => void;
  onChange: (patch: Partial<CanvasFrameItem>) => void;
  onDelete: () => void;
  onDragStart: (clientX: number, clientY: number) => void;
}

function IconChevron({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transform: collapsed ? 'rotate(-90deg)' : undefined }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function IconReview({ active }: { active: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 3h13l3 4-3 4H4z" />
    </svg>
  );
}

export default function FrameItem({ item, selected, zoom, onSelect, onChange, onDelete, onDragStart }: Props) {
  const collapsed = !!item.collapsed;

  /* Le cadre entier sert de poignée de déplacement — seuls les contrôles de
     l'en-tête (titre, replier, supprimer) coupent la propagation pour ne pas
     déclencher un glisser quand on interagit avec eux. */
  const onFrameMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect();
    onDragStart(e.clientX, e.clientY);
  };

  const startResize = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const startW = item.w, startH = item.h;
    const onMove = (ev: MouseEvent) => {
      const w = Math.max(220, startW + (ev.clientX - startX) / zoom);
      const h = Math.max(120, startH + (ev.clientY - startY) / zoom);
      onChange({ w, h });
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
      className={`canvas-frame${selected ? ' selected' : ''}${collapsed ? ' collapsed' : ''}${item.reviewEnabled ? ' review-enabled' : ''}`}
      style={{
        position: 'absolute',
        left: item.x,
        top: item.y,
        width: item.w,
        height: collapsed ? HEADER_H : item.h,
      }}
      onMouseDown={onFrameMouseDown}
    >
      <div className="frame-header">
        <button
          type="button"
          className="frame-collapse"
          title={collapsed ? 'Déplier' : 'Replier'}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => onChange({ collapsed: !collapsed })}
        >
          <IconChevron collapsed={collapsed} />
        </button>
        <input
          type="text"
          className="frame-title"
          value={item.title}
          placeholder="Cadre"
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => onChange({ title: e.target.value })}
        />
        <button
          type="button"
          className={`frame-review${item.reviewEnabled ? ' active' : ''}`}
          title={item.reviewEnabled ? 'Retirer des révisions' : 'Réviser ce cadre comme un seul sujet'}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => onChange({ reviewEnabled: !item.reviewEnabled })}
        >
          <IconReview active={!!item.reviewEnabled} />
        </button>
        <button
          type="button"
          className="frame-delete"
          title="Supprimer le cadre"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onDelete}
        >
          ✕
        </button>
      </div>

      {selected && !collapsed && (
        <span
          className="canvas-frame-resize"
          onMouseDown={startResize}
          style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'bottom right' }}
          title="Redimensionner le cadre"
        />
      )}
    </div>
  );
}
