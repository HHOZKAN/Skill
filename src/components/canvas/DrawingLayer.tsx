import type { CanvasStroke } from '../../types';

interface Props {
  strokes: CanvasStroke[];
  drafting: CanvasStroke | null;
}

function pathOf(points: [number, number][]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const [x, y] = points[0];
    return `M ${x} ${y} L ${x + 0.01} ${y + 0.01}`;
  }
  let d = `M ${points[0][0]} ${points[0][1]}`;
  /* Lissage quadratique : sommet courant comme contrôle, milieu segment suivant comme cible */
  for (let i = 1; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    d += ` Q ${x1} ${y1} ${mx} ${my}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last[0]} ${last[1]}`;
  return d;
}

function StrokePath({ stroke }: { stroke: CanvasStroke }) {
  return (
    <path
      d={pathOf(stroke.points)}
      fill="none"
      stroke={stroke.color}
      strokeWidth={stroke.width}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export default function DrawingLayer({ strokes, drafting }: Props) {
  return (
    <svg className="drawing-layer" xmlns="http://www.w3.org/2000/svg">
      {strokes.map((s) => <StrokePath key={s.id} stroke={s} />)}
      {drafting && <StrokePath stroke={drafting} />}
    </svg>
  );
}
