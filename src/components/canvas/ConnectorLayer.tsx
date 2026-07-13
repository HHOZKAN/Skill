import type { CanvasConnector, CanvasItem } from '../../types';

interface Props {
  items: CanvasItem[];
  connectors: CanvasConnector[];
  interactive: boolean;
  linkFrom: string | null;
  linkPreview: { x: number; y: number } | null;
  onDelete: (id: string) => void;
}

/* Centre + demi-largeur/hauteur d'un item, en coordonnées monde. Les blocs
   texte sans hauteur fixée (auto) n'ont pas de mesure DOM fiable pendant le
   rendu : on retombe sur une estimation raisonnable, comme ailleurs dans le
   canvas (cf. jumpToItem). */
function boxOf(it: CanvasItem) {
  const h = it.kind === 'text' ? (it.h ?? 120) : it.h;
  return { cx: it.x + it.w / 2, cy: it.y + h / 2, hw: it.w / 2, hh: h / 2 };
}

/* Point où le segment [centre → autre point] sort du rectangle du bloc */
function edgePoint(box: ReturnType<typeof boxOf>, tx: number, ty: number) {
  const dx = tx - box.cx, dy = ty - box.cy;
  if (dx === 0 && dy === 0) return { x: box.cx, y: box.cy };
  const t = Math.min(
    dx !== 0 ? box.hw / Math.abs(dx) : Infinity,
    dy !== 0 ? box.hh / Math.abs(dy) : Infinity,
  );
  return { x: box.cx + dx * t, y: box.cy + dy * t };
}

export default function ConnectorLayer({ items, connectors, interactive, linkFrom, linkPreview, onDelete }: Props) {
  const byId = new Map(items.map((it) => [it.id, it]));

  return (
    <svg className="connector-layer" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="cn-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className="cn-arrowhead" />
        </marker>
      </defs>
      {connectors.map((c) => {
        const a = byId.get(c.from);
        const b = byId.get(c.to);
        if (!a || !b) return null;
        const boxA = boxOf(a), boxB = boxOf(b);
        const pa = edgePoint(boxA, boxB.cx, boxB.cy);
        const pb = edgePoint(boxB, boxA.cx, boxA.cy);
        return (
          <g key={c.id} className="cn-group">
            <line className="cn-line" x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} markerEnd="url(#cn-arrow)" />
            {interactive && (
              <line
                className="cn-hit"
                x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                onMouseDown={(e) => { e.stopPropagation(); onDelete(c.id); }}
                onContextMenu={(e) => e.preventDefault()}
              />
            )}
          </g>
        );
      })}
      {linkFrom && linkPreview && byId.get(linkFrom) && (() => {
        const box = boxOf(byId.get(linkFrom)!);
        const pa = edgePoint(box, linkPreview.x, linkPreview.y);
        return <line className="cn-temp" x1={pa.x} y1={pa.y} x2={linkPreview.x} y2={linkPreview.y} />;
      })()}
    </svg>
  );
}
