import { useEffect } from 'react';

interface Props {
  left: number;
  top: number;
  onDuplicate: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onClose: () => void;
}

/* Menu contextuel (clic droit) d'un ou plusieurs blocs sélectionnés. Se ferme
   au clic ailleurs, à la molette (pan/zoom) ou avec Échap. */
export default function CanvasContextMenu({ left, top, onDuplicate, onBringToFront, onSendToBack, onClose }: Props) {
  useEffect(() => {
    const onDown = () => onClose();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('wheel', onClose);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('wheel', onClose);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const run = (fn: () => void) => () => { fn(); onClose(); };

  return (
    <div
      className="canvas-context-menu"
      style={{ left, top }}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button type="button" onClick={run(onDuplicate)}>Dupliquer<span className="ccm-kbd">Ctrl D</span></button>
      <button type="button" onClick={run(onBringToFront)}>Premier plan<span className="ccm-kbd">Ctrl ]</span></button>
      <button type="button" onClick={run(onSendToBack)}>Arrière-plan<span className="ccm-kbd">Ctrl [</span></button>
    </div>
  );
}
