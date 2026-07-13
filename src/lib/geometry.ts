import type { CanvasItem } from '../types';

export type Rect = { x: number; y: number; w: number; h: number };

/* Rect monde d'un item (un texte en hauteur auto retombe sur une estimation
   raisonnable, comme ailleurs dans le canvas). Partagé entre le canvas
   (regroupement des cadres, alignement) et le mode révision (contenu d'un
   cadre marqué "à réviser"). */
export function worldRectOf(it: CanvasItem): Rect {
  return {
    x: it.x,
    y: it.y,
    w: it.w,
    h: it.kind === 'text' ? (it.h ?? 120) : it.h,
  };
}

export function isFullyInside(inner: Rect, outer: Rect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
}
