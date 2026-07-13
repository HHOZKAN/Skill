import { useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';
import { findBacklinks } from '../../lib/backlinks';

interface Props {
  treeId: string;
  nodeId: string;
  onNavigate: (treeId: string, nodeId: string) => void;
}

function IconBacklink() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 7L4 12l5 5" />
      <path d="M4 12h11a5 5 0 0 0 0-10h-1" />
    </svg>
  );
}

/* Liens entrants : autres notes de l'atlas qui mentionnent (via "@") celle-ci */
export default function BacklinksPanel({ treeId, nodeId, onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const trees = useStore((s) => s.trees);
  const backlinks = useMemo(() => findBacklinks(trees, treeId, nodeId), [trees, treeId, nodeId]);

  return (
    <div className="canvas-right-block" onMouseDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`ct-toc-toggle${open ? ' active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="Liens entrants"
        aria-label="Liens entrants"
      >
        <IconBacklink />
        {backlinks.length > 0 && <span className="ct-badge">{backlinks.length}</span>}
      </button>
      {open && (
        <div className="canvas-toc-panel">
          <div className="toc-title">Liens entrants</div>
          {backlinks.length === 0 ? (
            <div className="toc-empty">Aucune autre note ne référence celle-ci pour l’instant (tape "@" dans un bloc pour créer un lien).</div>
          ) : (
            <ul>
              {backlinks.map((b) => (
                <li key={`${b.treeId}-${b.nodeId}`} className="toc-item">
                  <button type="button" onClick={() => onNavigate(b.treeId, b.nodeId)} title={`${b.treeName} — ${b.nodeName}`}>
                    {b.nodeName} <span className="toc-item-sub">— {b.treeName}</span>
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
