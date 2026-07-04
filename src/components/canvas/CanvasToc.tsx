import type { CanvasHeading } from '../../lib/canvas';

interface Props {
  headings: CanvasHeading[];
  open: boolean;
  onToggle: () => void;
  onJump: (itemId: string) => void;
}

function IconList() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

export default function CanvasToc({ headings, open, onToggle, onJump }: Props) {
  return (
    <div className="canvas-right-block" onMouseDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`ct-toc-toggle${open ? ' active' : ''}`}
        onClick={onToggle}
        title="Sommaire"
        aria-label="Sommaire"
      >
        <IconList />
      </button>
      {open && (
        <div className="canvas-toc-panel">
          <div className="toc-title">Sommaire</div>
          {headings.length === 0 ? (
            <div className="toc-empty">Ajoute des titres (H1, H2…) pour voir le sommaire ici.</div>
          ) : (
            <ul>
              {headings.map((h, i) => (
                <li key={`${h.itemId}-${i}`} className={`toc-item lvl-${h.level}`}>
                  <button type="button" onClick={() => onJump(h.itemId)} title={h.text}>
                    {h.text}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
