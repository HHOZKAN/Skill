import type { GuideLine, GapLine } from '../../lib/snapping';

interface Props {
  guides: GuideLine[];
  gaps: GapLine[];
  zoom: number;
}

const TICK_PX = 4;

/* Guides d'alignement + lignes de cotation (distance) affichés pendant un
   glisser, façon Figma. Purement visuel, aucune interaction. */
export default function AlignmentGuides({ guides, gaps, zoom }: Props) {
  if (!guides.length && !gaps.length) return null;
  const tick = TICK_PX / zoom;

  return (
    <>
      <svg className="alignment-guides-layer" xmlns="http://www.w3.org/2000/svg">
        {guides.map((g, i) => (
          g.axis === 'v'
            ? <line key={`g${i}`} className="align-guide" x1={g.pos} y1={g.start} x2={g.pos} y2={g.end} />
            : <line key={`g${i}`} className="align-guide" x1={g.start} y1={g.pos} x2={g.end} y2={g.pos} />
        ))}
        {gaps.map((g, i) => (
          <g key={`d${i}`} className="align-dim">
            <line className="align-dim-line" x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} />
            {g.axis === 'h' ? (
              <>
                <line className="align-dim-tick" x1={g.x1} y1={g.y1 - tick} x2={g.x1} y2={g.y1 + tick} />
                <line className="align-dim-tick" x1={g.x2} y1={g.y2 - tick} x2={g.x2} y2={g.y2 + tick} />
              </>
            ) : (
              <>
                <line className="align-dim-tick" x1={g.x1 - tick} y1={g.y1} x2={g.x1 + tick} y2={g.y1} />
                <line className="align-dim-tick" x1={g.x2 - tick} y1={g.y2} x2={g.x2 + tick} y2={g.y2} />
              </>
            )}
          </g>
        ))}
      </svg>
      {gaps.map((g, i) => (
        <div
          key={`l${i}`}
          className="align-gap-label"
          style={{ left: (g.x1 + g.x2) / 2, top: (g.y1 + g.y2) / 2, transform: `translate(-50%, -50%) scale(${1 / zoom})` }}
        >
          {g.text}
        </div>
      ))}
    </>
  );
}
