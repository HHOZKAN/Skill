import { STICKY_COLORS } from '../../lib/canvas';
import type { CanvasTextItem } from '../../types';

interface Props {
  item: CanvasTextItem;
  anchor: { left: number; top: number };
  onSetBg: (color: string | null) => void;
}

/* Rendu hors de l'arbre tourné du bloc : positionné en coordonnées écran
   réelles (mesurées), donc toujours bien droit et jamais entraîné par la
   rotation du post-it — contrairement à une contre-rotation locale, qui
   annule l'angle mais introduit un décalage de position (deux rotations
   autour de deux centres différents = une translation). */
export default function BlockBgPill({ item, anchor, onSetBg }: Props) {
  return (
    <div
      className="canvas-text-bg-pill"
      onMouseDown={(e) => e.stopPropagation()}
      style={{ left: anchor.left, top: anchor.top - 44 }}
    >
      <button
        type="button"
        className={`bgp-swatch bgp-none${!item.bg ? ' active' : ''}`}
        title="Papier (sans fond)"
        onClick={() => onSetBg(null)}
      >
        ⌀
      </button>
      {STICKY_COLORS.map((c) => (
        <button
          key={c.color}
          type="button"
          className={`bgp-swatch${item.bg === c.color ? ' active' : ''}`}
          title={`Post-it ${c.title}`}
          style={{ background: c.color }}
          onClick={() => onSetBg(c.color)}
        />
      ))}
    </div>
  );
}
