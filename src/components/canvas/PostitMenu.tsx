import { STICKY_COLORS } from '../../lib/canvas';

interface Props {
  open: boolean;
  onToggle: () => void;
  onAdd: (color: string) => void;
}

function IconSticky() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 4h13l3 3v13H4V4z" />
      <path d="M17 4v3h3" />
    </svg>
  );
}

export default function PostitMenu({ open, onToggle, onAdd }: Props) {
  return (
    <div className="canvas-right-block" onMouseDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`ct-toc-toggle${open ? ' active' : ''}`}
        onClick={onToggle}
        title="Ajouter un post-it"
        aria-label="Ajouter un post-it"
      >
        <IconSticky />
      </button>
      {open && (
        <div className="postit-panel">
          <div className="toc-title">Post-it</div>
          <div className="postit-swatches">
            {STICKY_COLORS.map((c) => (
              <button
                key={c.color}
                type="button"
                className="postit-swatch"
                title={`Ajouter un post-it ${c.title}`}
                style={{ background: c.color }}
                onClick={() => onAdd(c.color)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
