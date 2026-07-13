import { useState } from 'react';
import { PACER_INFO, STICKY_COLORS } from '../../lib/canvas';
import type { CanvasTextItem, PacerCode } from '../../types';

interface Props {
  item: CanvasTextItem;
  onChange: (patch: Partial<CanvasTextItem>) => void;
  onSetBg: (color: string | null) => void;
  onSetLink: (link: string | null) => void;
  onSetPacer: (code: PacerCode | null) => void;
}

const PACER_CODES = Object.keys(PACER_INFO) as PacerCode[];

const ROTATE_STEP = 15;
const MIN_W = 140;
const MIN_H = 60;

/* Menu de modification du bloc texte sélectionné : couleur (post-it ou papier),
   lien (vidéo YouTube ou URL, pour prendre des notes dessus), rotation et
   taille (une fois un fond choisi). Remplace le glisser des poignées d'angle,
   trop instable, par des contrôles explicites. Affiché dans la pile de droite,
   sous le bouton d'ajout de post-it. Le plan (avant/arrière) et la duplication
   se gèrent via le clic droit (CanvasContextMenu). */
export default function PostitAdjustPanel({ item, onChange, onSetBg, onSetLink, onSetPacer }: Props) {
  const rotate = item.rotate ?? 0;
  const [draftLink, setDraftLink] = useState('');

  const submitLink = (e: React.FormEvent) => {
    e.preventDefault();
    const v = draftLink.trim();
    if (!v) return;
    onSetLink(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    setDraftLink('');
  };

  return (
    <div className="postit-adjust-panel" onMouseDown={(e) => e.stopPropagation()}>
      <div className="toc-title">Ajuster le bloc</div>

      <div className="pap-row">
        <span className="pap-label">Couleur</span>
        <div className="pap-swatches">
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
      </div>

      <div className="pap-row">
        <span className="pap-label">PACER</span>
        <div className="pap-group">
          {PACER_CODES.map((code) => (
            <button
              key={code}
              type="button"
              className={`pap-pacer${item.pacer === code ? ' active' : ''}`}
              style={{ '--pacer-color': PACER_INFO[code].color } as React.CSSProperties}
              title={`${PACER_INFO[code].label} — ${PACER_INFO[code].hint}`}
              onClick={() => onSetPacer(item.pacer === code ? null : code)}
            >
              {code}
            </button>
          ))}
        </div>
      </div>

      {item.bg && (
        <div className="pap-row">
          <span className="pap-label">Rotation</span>
          <div className="pap-group">
            <button
              type="button"
              className="pap-btn"
              title="Pivoter à gauche"
              onClick={() => onChange({ rotate: rotate - ROTATE_STEP })}
            >
              ⟲
            </button>
            <button
              type="button"
              className={`pap-value${rotate !== 0 ? ' pap-value-active' : ''}`}
              title="Réinitialiser la rotation"
              onClick={() => onChange({ rotate: 0 })}
            >
              {Math.round(rotate)}°
            </button>
            <button
              type="button"
              className="pap-btn"
              title="Pivoter à droite"
              onClick={() => onChange({ rotate: rotate + ROTATE_STEP })}
            >
              ⟳
            </button>
          </div>
        </div>
      )}

      <div className="pap-row">
        <span className="pap-label">Taille</span>
        <div className="pap-group">
          <input
            type="number"
            className="pap-input"
            title="Largeur"
            min={MIN_W}
            step={10}
            disabled={!!item.autoWidth}
            value={Math.round(item.w)}
            onChange={(e) => onChange({ w: Math.max(MIN_W, Number(e.target.value) || MIN_W) })}
          />
          <span className="pap-x">×</span>
          <input
            type="number"
            className="pap-input"
            title="Hauteur"
            min={MIN_H}
            step={10}
            placeholder="auto"
            disabled={!!item.autoHeight}
            value={item.h != null ? Math.round(item.h) : ''}
            onChange={(e) => onChange({ h: Math.max(MIN_H, Number(e.target.value) || MIN_H) })}
          />
        </div>
        <div className="pap-group">
          <button
            type="button"
            className={`pap-auto${item.autoWidth ? ' active' : ''}`}
            title="La largeur épouse le contenu du texte"
            onClick={() => onChange({ autoWidth: !item.autoWidth })}
          >
            Largeur auto
          </button>
          <button
            type="button"
            className={`pap-auto${item.autoHeight ? ' active' : ''}`}
            title="La hauteur épouse le contenu du texte"
            onClick={() => onChange({ autoHeight: !item.autoHeight })}
          >
            Hauteur auto
          </button>
        </div>
      </div>

      <div className="pap-row">
        <span className="pap-label">Lien / vidéo</span>
        {item.link ? (
          <div className="pap-link-current">
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="pap-link-url"
              title={item.link}
            >
              {item.link.replace(/^https?:\/\//, '')}
            </a>
            <button type="button" className="pap-btn" title="Retirer le lien" onClick={() => onSetLink(null)}>✕</button>
          </div>
        ) : (
          <form className="pap-link-form" onSubmit={submitLink}>
            <input
              type="text"
              className="pap-input pap-link-input"
              placeholder="Coller une URL (YouTube…)"
              value={draftLink}
              onChange={(e) => setDraftLink(e.target.value)}
            />
            <button type="submit" className="pap-btn" title="Ajouter le lien">＋</button>
          </form>
        )}
      </div>
    </div>
  );
}
