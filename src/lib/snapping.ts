export interface Rect { x: number; y: number; w: number; h: number }
export interface GuideLine { axis: 'v' | 'h'; pos: number; start: number; end: number }
/* Ligne de cotation (comme dans Figma) : un segment entre deux blocs, avec la
   distance affichée en son centre. `axis` = orientation du segment lui-même
   ('h' = horizontal, mesure un écart gauche/droite ; 'v' = vertical, mesure
   un écart au-dessus/en-dessous). */
export interface GapLine { axis: 'h' | 'v'; x1: number; y1: number; x2: number; y2: number; text: string }
export interface SnapResult { x: number; y: number; guides: GuideLine[]; gaps: GapLine[] }

const SNAP_PX = 6;
const GAP_SNAP_PX = 4;
const REFINE_PX = 1;

/* Alignement + espacement façon Figma pendant un glisser : accroche les
   bords/centres du bloc déplacé sur ceux des autres blocs (seuil en pixels
   écran, converti en unités monde selon le zoom), et — s'il n'y a pas déjà un
   alignement direct sur cet axe — centre le bloc entre ses deux voisins les
   plus proches quand les deux marges sont presque égales. */
export function computeSnap(rect: Rect, others: Rect[], zoom: number): SnapResult {
  const snapThreshold = SNAP_PX / zoom;
  const gapThreshold = GAP_SNAP_PX / zoom;
  const refineEps = REFINE_PX / zoom;

  let { x, y } = rect;
  const { w, h } = rect;

  /* ---- alignement des bords/centre, axe X ---- */
  let dxUsed: number | null = null;
  let bestDistX = snapThreshold;
  for (const r of others) {
    const candidates = [r.x, r.x + r.w / 2, r.x + r.w];
    for (const cv of candidates) {
      for (const dv of [x, x + w / 2, x + w]) {
        const d = Math.abs(cv - dv);
        if (d <= bestDistX) { bestDistX = d; dxUsed = cv - dv; }
      }
    }
  }
  if (dxUsed !== null) x += dxUsed;

  /* ---- alignement des bords/centre, axe Y ---- */
  let dyUsed: number | null = null;
  let bestDistY = snapThreshold;
  for (const r of others) {
    const candidates = [r.y, r.y + r.h / 2, r.y + r.h];
    for (const cv of candidates) {
      for (const dv of [y, y + h / 2, y + h]) {
        const d = Math.abs(cv - dv);
        if (d <= bestDistY) { bestDistY = d; dyUsed = cv - dv; }
      }
    }
  }
  if (dyUsed !== null) y += dyUsed;

  const gaps: GapLine[] = [];

  /* ---- espacement égal, axe X (seulement si pas déjà aligné sur X) ---- */
  if (dxUsed === null) {
    const overlapsY = (r: Rect) => r.y < y + h && r.y + r.h > y;
    const row = others.filter(overlapsY);
    const left = row.filter((r) => r.x + r.w <= x + 0.01)
      .sort((a, b) => (x - (b.x + b.w)) - (x - (a.x + a.w)))[0];
    const right = row.filter((r) => r.x >= x + w - 0.01)
      .sort((a, b) => (a.x - (x + w)) - (b.x - (x + w)))[0];

    if (left && right) {
      const centeredX = (right.x + left.x + left.w - w) / 2;
      if (Math.abs(x - centeredX) <= gapThreshold) x = centeredX;
      const midY = (Math.max(y, Math.max(left.y, right.y))
        + Math.min(y + h, Math.min(left.y + left.h, right.y + right.h))) / 2;
      const gapLeft = x - (left.x + left.w);
      const gapRight = right.x - (x + w);
      gaps.push({ axis: 'h', x1: left.x + left.w, y1: midY, x2: x, y2: midY, text: `${Math.round(gapLeft)}` });
      gaps.push({ axis: 'h', x1: x + w, y1: midY, x2: right.x, y2: midY, text: `${Math.round(gapRight)}` });
    } else if (left || right) {
      const n = (left ?? right)!;
      const midY = (Math.max(y, n.y) + Math.min(y + h, n.y + n.h)) / 2;
      const gx1 = left ? left.x + left.w : x + w;
      const gx2 = left ? x : n.x;
      gaps.push({ axis: 'h', x1: gx1, y1: midY, x2: gx2, y2: midY, text: `${Math.round(Math.abs(gx2 - gx1))}` });
    }
  }

  /* ---- espacement égal, axe Y (seulement si pas déjà aligné sur Y) ---- */
  if (dyUsed === null) {
    const overlapsX = (r: Rect) => r.x < x + w && r.x + r.w > x;
    const col = others.filter(overlapsX);
    const above = col.filter((r) => r.y + r.h <= y + 0.01)
      .sort((a, b) => (y - (b.y + b.h)) - (y - (a.y + a.h)))[0];
    const below = col.filter((r) => r.y >= y + h - 0.01)
      .sort((a, b) => (a.y - (y + h)) - (b.y - (y + h)))[0];

    if (above && below) {
      const centeredY = (below.y + above.y + above.h - h) / 2;
      if (Math.abs(y - centeredY) <= gapThreshold) y = centeredY;
      const midX = (Math.max(x, Math.max(above.x, below.x))
        + Math.min(x + w, Math.min(above.x + above.w, below.x + below.w))) / 2;
      const gapAbove = y - (above.y + above.h);
      const gapBelow = below.y - (y + h);
      gaps.push({ axis: 'v', x1: midX, y1: above.y + above.h, x2: midX, y2: y, text: `${Math.round(gapAbove)}` });
      gaps.push({ axis: 'v', x1: midX, y1: y + h, x2: midX, y2: below.y, text: `${Math.round(gapBelow)}` });
    } else if (above || below) {
      const n = (above ?? below)!;
      const midX = (Math.max(x, n.x) + Math.min(x + w, n.x + n.w)) / 2;
      const gy1 = above ? above.y + above.h : y + h;
      const gy2 = above ? y : n.y;
      gaps.push({ axis: 'v', x1: midX, y1: gy1, x2: midX, y2: gy2, text: `${Math.round(Math.abs(gy2 - gy1))}` });
    }
  }

  /* ---- lignes d'alignement à la position finale (peut en révéler d'autres) ---- */
  const guides: GuideLine[] = [];
  for (const r of others) {
    for (const cv of [r.x, r.x + r.w / 2, r.x + r.w]) {
      for (const dv of [x, x + w / 2, x + w]) {
        if (Math.abs(cv - dv) <= refineEps) {
          guides.push({ axis: 'v', pos: cv, start: Math.min(y, r.y), end: Math.max(y + h, r.y + r.h) });
        }
      }
    }
    for (const cv of [r.y, r.y + r.h / 2, r.y + r.h]) {
      for (const dv of [y, y + h / 2, y + h]) {
        if (Math.abs(cv - dv) <= refineEps) {
          guides.push({ axis: 'h', pos: cv, start: Math.min(x, r.x), end: Math.max(x + w, r.x + r.w) });
        }
      }
    }
  }

  return { x, y, guides, gaps };
}
