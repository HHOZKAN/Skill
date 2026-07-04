export type Tool = 'select' | 'text' | 'pen' | 'eraser';

export const PEN_COLORS = ['#0f172a', '#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#a855f7'] as const;
export const PEN_WIDTHS = [1.5, 3, 6] as const;

interface Props {
  tool: Tool;
  setTool: (t: Tool) => void;
  zoom: number;
  onZoomReset: () => void;
  onImportImage: () => void;
  penColor: string;
  setPenColor: (c: string) => void;
  penWidth: number;
  setPenWidth: (w: number) => void;
}

function IconCursor() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 3l5 17 3-7 7-3z" />
    </svg>
  );
}
function IconText() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 5h12M12 5v14M9 19h6" />
    </svg>
  );
}
function IconImage() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.7" />
      <path d="M21 17l-5-5-8 8" />
    </svg>
  );
}
function IconPen() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 21l4-1 11.5-11.5a2 2 0 0 0 0-2.8L17.3 4.5a2 2 0 0 0-2.8 0L3 16v5z" />
      <path d="M14 6l4 4" />
    </svg>
  );
}
function IconEraser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 3l5 5-10 10H6l-3-3 13-12z" />
      <path d="M9 10l5 5" />
    </svg>
  );
}

export default function CanvasToolbar({
  tool, setTool, zoom, onZoomReset, onImportImage,
  penColor, setPenColor, penWidth, setPenWidth,
}: Props) {
  const Btn = ({ t, label, hint, children }: { t: Tool; label: string; hint: string; children: React.ReactNode }) => (
    <button
      type="button"
      className={`ct-btn${tool === t ? ' active' : ''}`}
      onClick={() => setTool(t)}
      title={`${label} — ${hint}`}
      aria-label={label}
    >
      {children}
    </button>
  );

  return (
    <div className="canvas-toolbar" onMouseDown={(e) => e.stopPropagation()}>
      <Btn t="select" label="Sélection" hint="V"><IconCursor /></Btn>
      <Btn t="text" label="Texte" hint="T"><IconText /></Btn>
      <Btn t="pen" label="Plume" hint="B"><IconPen /></Btn>
      <Btn t="eraser" label="Gomme" hint="E"><IconEraser /></Btn>
      <button
        type="button"
        className="ct-btn"
        onClick={onImportImage}
        title="Importer une image (ou glisse-dépose / colle directement)"
        aria-label="Image"
      >
        <IconImage />
      </button>

      {tool === 'pen' && (
        <div className="ct-pen-settings">
          <div className="ct-colors">
            {PEN_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`ct-color${penColor === c ? ' active' : ''}`}
                style={{ background: c }}
                onClick={() => setPenColor(c)}
                title={c}
                aria-label={`Couleur ${c}`}
              />
            ))}
          </div>
          <div className="ct-widths">
            {PEN_WIDTHS.map((w) => (
              <button
                key={w}
                type="button"
                className={`ct-width${penWidth === w ? ' active' : ''}`}
                onClick={() => setPenWidth(w)}
                title={`Épaisseur ${w}`}
                aria-label={`Épaisseur ${w}`}
              >
                <span style={{ width: `${w * 2}px`, height: `${w * 2}px`, background: penColor }} />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="ct-sep" />
      <button
        type="button"
        className="ct-zoom"
        onClick={onZoomReset}
        title="Réinitialiser le zoom et la position"
      >
        {Math.round(zoom * 100)}%
      </button>
    </div>
  );
}
