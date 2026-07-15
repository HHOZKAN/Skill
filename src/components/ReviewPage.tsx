import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { IBack } from './Icons';
import { useStore } from '../store/useStore';
import { PACER_INFO } from '../lib/canvas';
import { collectReviewCards, groupByDeck, type ReviewCard } from '../lib/review';

interface Props {
  onBack: () => void;
  onOpenNote: (treeId: string, nodeId: string) => void;
}

const cardKey = (c: Pick<ReviewCard, 'treeId' | 'itemId'>) => `${c.treeId}:${c.itemId}`;

const truncate = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n)}…` : s);

/* Les cadres marqués "à réviser" n'ont pas de catégorie PACER — badge dédié */
function pacerBadge(card: Pick<ReviewCard, 'pacer'>): { short: string; full: string; color: string } {
  if (!card.pacer) return { short: 'Cadre', full: 'Cadre — sujet regroupé', color: '#ca8a04' };
  return { short: card.pacer, full: `${card.pacer} · ${PACER_INFO[card.pacer].label}`, color: PACER_INFO[card.pacer].color };
}

type SortBy = 'name' | 'total';

interface ReviewCardViewProps {
  card: ReviewCard;
  onBack: () => void;
  onOpenNote: () => void;
}

/* Simple lecture d'un sujet : le texte du bloc et un lien direct vers la note
   complète — plus de session, de statut ou d'historique sur cette page. */
function ReviewCardView({ card, onBack, onOpenNote }: ReviewCardViewProps) {
  const badge = pacerBadge(card);
  return (
    <motion.div className="review-session" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
      <div className="review-pane-main">
        <div className="review-card-breadcrumb">{card.treeName} › {card.nodeName}</div>
        <span className="review-card-pacer" style={{ background: badge.color }}>{badge.full}</span>
        <div className="review-card-text">{card.text}</div>
        <div className="review-card-actions">
          <button type="button" className="review-btn" onClick={onBack}>‹ Retour à la liste</button>
          <button type="button" className="review-btn known" onClick={onOpenNote}>Voir la note complète</button>
        </div>
      </div>
    </motion.div>
  );
}

export default function ReviewPage({ onBack, onOpenNote }: Props) {
  const trees = useStore((s) => s.trees);
  const [browseTreeId, setBrowseTreeId] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<ReviewCard | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('total');

  const allCards = useMemo(() => collectReviewCards(trees), [trees]);
  const decks = useMemo(() => groupByDeck(allCards), [allCards]);

  const visibleDecks = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? decks.filter((d) => d.treeName.toLowerCase().includes(q)) : decks;
    const sorted = [...list];
    if (sortBy === 'name') sorted.sort((a, b) => a.treeName.localeCompare(b.treeName));
    else sorted.sort((a, b) => b.totalCount - a.totalCount);
    return sorted;
  }, [decks, search, sortBy]);

  const browseTreeName = browseTreeId ? (decks.find((d) => d.treeId === browseTreeId)?.treeName ?? 'Tous les sujets') : '';
  const browseCards = useMemo(() => {
    if (!browseTreeId) return [];
    if (browseTreeId === 'all') return allCards;
    return allCards.filter((c) => c.treeId === browseTreeId);
  }, [allCards, browseTreeId]);

  const goBack = () => {
    if (selectedCard) { setSelectedCard(null); return; }
    if (browseTreeId) { setBrowseTreeId(null); return; }
    onBack();
  };

  const headerTitle = selectedCard
    ? `${selectedCard.treeName} › ${selectedCard.nodeName}`
    : browseTreeId ? browseTreeName : 'Mode révision';
  const headerCount = selectedCard
    ? ''
    : browseTreeId
      ? `${browseCards.length} sujet${browseCards.length !== 1 ? 's' : ''}`
      : `${allCards.length} sujet${allCards.length !== 1 ? 's' : ''} au total`;

  return (
    <div className="notes-editor review-page">
      <div className="note-header">
        <motion.button className="note-back" title="Retour" onClick={goBack} whileTap={{ scale: 0.93 }}>
          <IBack size={16} />
        </motion.button>
        <div className="review-title">
          <span>{headerTitle}</span>
          {headerCount && <span className="review-count">{headerCount}</span>}
        </div>
      </div>

      <div className={`review-body${selectedCard ? ' review-body-session' : ''}`}>
        {!selectedCard && !browseTreeId && (
          allCards.length === 0 ? (
            <div className="review-empty">
              <div className="review-empty-emoji">🗂️</div>
              <div className="review-empty-title">Aucun sujet marqué pour la révision</div>
              <div className="review-empty-sub">
                Étiquette des blocs "Référence" ou "Evidence" (PACER) dans tes notes pour qu’ils apparaissent ici.
              </div>
            </div>
          ) : (
            <div className="review-decks-screen">
              <div className="review-toolbar">
                <input
                  type="text"
                  className="review-search"
                  placeholder="Rechercher une constellation…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select className="review-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
                  <option value="total">Le plus de sujets</option>
                  <option value="name">Nom (A→Z)</option>
                </select>
              </div>

              <div className="review-deck-grid">
                <button
                  type="button"
                  className="review-deck-card review-deck-all"
                  onClick={() => setBrowseTreeId('all')}
                >
                  <span className="review-deck-name">Tous les sujets</span>
                  <span className="review-deck-due">{allCards.length}</span>
                  <span className="review-deck-sub">au total</span>
                </button>
                {visibleDecks.map((d) => (
                  <button
                    key={d.treeId}
                    type="button"
                    className="review-deck-card"
                    onClick={() => setBrowseTreeId(d.treeId)}
                  >
                    <span className="review-deck-name">{d.treeName}</span>
                    <span className="review-deck-due">{d.totalCount}</span>
                    <span className="review-deck-sub">sujet{d.totalCount !== 1 ? 's' : ''}</span>
                  </button>
                ))}
                {visibleDecks.length === 0 && (
                  <div className="review-deck-empty">Aucune constellation ne correspond à "{search}".</div>
                )}
              </div>
            </div>
          )
        )}

        {!selectedCard && browseTreeId && (
          <div className="review-browse-screen">
            <div className="review-browse-list">
              {browseCards.map((c) => {
                const badge = pacerBadge(c);
                return (
                  <button
                    key={cardKey(c)}
                    type="button"
                    className="review-browse-row"
                    onClick={() => setSelectedCard(c)}
                  >
                    <span className="review-browse-pacer" style={{ background: badge.color }}>{badge.short}</span>
                    <span className="review-browse-main">
                      <span className="review-browse-node">{c.nodeName}</span>
                      <span className="review-browse-excerpt">{truncate(c.text)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {selectedCard && (
          <ReviewCardView
            card={selectedCard}
            onBack={() => setSelectedCard(null)}
            onOpenNote={() => onOpenNote(selectedCard.treeId, selectedCard.nodeId)}
          />
        )}
      </div>
    </div>
  );
}
