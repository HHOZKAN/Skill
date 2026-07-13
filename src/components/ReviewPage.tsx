import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { IBack } from './Icons';
import { useStore } from '../store/useStore';
import { getOrMigrateCanvas, newId, PACER_INFO } from '../lib/canvas';
import { collectReviewCards, groupByDeck, isDue, nextReviewState, SESSION_SIZE, WEEK_MS, type ReviewCard } from '../lib/review';
import type { CanvasFrameItem, CanvasTextItem, ReviewLogEntry } from '../types';

interface Props {
  onBack: () => void;
  onOpenNote: (treeId: string, nodeId: string) => void;
}

interface Session {
  treeId: string | null; // null = toutes les constellations mélangées
  treeName: string;
  ids: Set<string>; // clés "treeId:itemId" figées au lancement de la session
}

const cardKey = (c: Pick<ReviewCard, 'treeId' | 'itemId'>) => `${c.treeId}:${c.itemId}`;

const formatLogDate = (date: number) =>
  new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

/* Repère relatif rapide à lire dans un journal, avec la date exacte en infobulle */
function formatRelative(date: number): string {
  const days = Math.floor((Date.now() - date) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} jours`;
  if (days < 30) return `il y a ${Math.floor(days / 7)} sem.`;
  return formatLogDate(date);
}

const truncate = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n)}…` : s);

function cardStatus(card: ReviewCard): { text: string; due: boolean } {
  if (!card.review) return { text: 'Jamais révisé', due: true };
  if (isDue(card)) return { text: 'À réviser', due: true };
  return { text: `Prochaine révision : ${formatLogDate(card.review.dueAt)}`, due: false };
}

/* Les cadres marqués "à réviser" n'ont pas de catégorie PACER — badge dédié */
function pacerBadge(card: Pick<ReviewCard, 'pacer'>): { short: string; full: string; color: string } {
  if (!card.pacer) return { short: 'Cadre', full: 'Cadre — sujet regroupé', color: '#ca8a04' };
  return { short: card.pacer, full: `${card.pacer} · ${PACER_INFO[card.pacer].label}`, color: PACER_INFO[card.pacer].color };
}

type SortBy = 'due' | 'name' | 'total';

interface ReviewLogEntryViewProps {
  entry: ReviewLogEntry;
  onEdit: (note: string) => void;
  onDelete: () => void;
}

/* Une entrée du journal : consultable, mais aussi corrigeable ou supprimable —
   un carnet qu'on ne peut jamais retoucher perd vite sa valeur. */
function ReviewLogEntryView({ entry, onEdit, onDelete }: ReviewLogEntryViewProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.note);

  const save = () => {
    onEdit(draft);
    setEditing(false);
  };

  return (
    <div className="review-log-entry">
      <span className={`review-log-dot${entry.remembered ? ' ok' : ' ko'}`} />
      <div className="review-log-body">
        <div className="review-log-date" title={formatLogDate(entry.date)}>
          {formatRelative(entry.date)} · <span className={entry.remembered ? 'ok' : 'ko'}>{entry.remembered ? 'su' : 'à revoir'}</span>
          <span className="review-log-tools">
            <button type="button" title="Modifier" onClick={() => { setDraft(entry.note); setEditing(true); }}>✎</button>
            <button type="button" title="Supprimer" onClick={onDelete}>✕</button>
          </span>
        </div>
        {editing ? (
          <div className="review-log-edit">
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus rows={2} />
            <div className="review-log-edit-actions">
              <button type="button" className="review-log-edit-cancel" onClick={() => setEditing(false)}>Annuler</button>
              <button type="button" className="review-log-edit-save" onClick={save}>Enregistrer</button>
            </div>
          </div>
        ) : (
          entry.note && <div className="review-log-note">{entry.note}</div>
        )}
      </div>
    </div>
  );
}

interface ReviewSessionCardProps {
  card: ReviewCard;
  onAnswer: (remembered: boolean, note: string) => void;
  onOpenNote: () => void;
  onEditLog: (logId: string, note: string) => void;
  onDeleteLog: (logId: string) => void;
  onToggleChecklist: (itemId: string) => void;
  onAddChecklist: (label: string) => void;
  onRemoveChecklist: (itemId: string) => void;
  onResetWeeklyChecklist: () => void;
}

/* Une clé React par bloc réinitialise naturellement le brouillon de note
   quand on passe à la carte suivante — pas besoin d'effet dédié. */
function ReviewSessionCard({
  card, onAnswer, onOpenNote, onEditLog, onDeleteLog,
  onToggleChecklist, onAddChecklist, onRemoveChecklist, onResetWeeklyChecklist,
}: ReviewSessionCardProps) {
  const [note, setNote] = useState('');
  const [newChecklistLabel, setNewChecklistLabel] = useState('');
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const log = useMemo(() => [...card.reviewLog].sort((a, b) => b.date - a.date), [card.reviewLog]);
  const badge = pacerBadge(card);

  /* La zone grandit avec le texte plutôt que de rester une petite boîte figée */
  useEffect(() => {
    const el = noteRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [note]);

  /* Nouvelle semaine → la checklist d'entraînement se remet à zéro toute
     seule (une fois par carte, au premier affichage). */
  useEffect(() => {
    const last = card.weeklyChecklistResetAt ?? 0;
    if (card.weeklyChecklist.length > 0 && Date.now() - last >= WEEK_MS) {
      onResetWeeklyChecklist();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitChecklist = (e: React.FormEvent) => {
    e.preventDefault();
    const label = newChecklistLabel.trim();
    if (!label) return;
    onAddChecklist(label);
    setNewChecklistLabel('');
  };

  return (
    <motion.div className="review-session" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
      <div className="review-pane-main">
        <div className="review-card-breadcrumb">{card.treeName} › {card.nodeName}</div>
        <span className="review-card-pacer" style={{ background: badge.color }}>{badge.full}</span>
        <div className="review-card-text">{card.text}</div>
        <button type="button" className="review-card-open" onClick={onOpenNote}>Voir la note complète</button>

        <textarea
          ref={noteRef}
          className="review-note-input"
          placeholder="Qu'est-ce que tu en retiens ou as compris cette fois ? (optionnel)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={1}
        />

        <div className="review-card-actions">
          <button type="button" className="review-btn forgot" onClick={() => onAnswer(false, note)}>À revoir</button>
          <button type="button" className="review-btn known" onClick={() => onAnswer(true, note)}>Je m’en souviens</button>
        </div>
      </div>

      {/* Zone invisible qui déclenche l'ouverture au survol du bord droit */}
      <div className="review-edge-trigger" />

      <div className="review-flyout">
        <div className="review-flyout-handle" title="Historique et checklist">📓</div>
        <div className="review-flyout-content">
          <div className="review-log">
            <div className="review-log-title">Historique{log.length > 0 ? ` (${log.length})` : ''}</div>
            {log.length === 0 ? (
              <div className="review-log-empty">Première relecture — pas encore d’historique.</div>
            ) : (
              <div className="review-log-list">
                {log.map((entry) => (
                  <ReviewLogEntryView
                    key={entry.id}
                    entry={entry}
                    onEdit={(note) => onEditLog(entry.id, note)}
                    onDelete={() => onDeleteLog(entry.id)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="review-checklist">
            <div className="review-log-title">Entraînement de la semaine</div>
            {card.weeklyChecklist.length === 0 ? (
              <div className="review-log-empty">Ajoute les points à vérifier à chaque entraînement — la liste se décoche toute seule chaque semaine.</div>
            ) : (
              <div className="review-checklist-list">
                {card.weeklyChecklist.map((ci) => (
                  <label key={ci.id} className="review-checklist-item">
                    <input type="checkbox" checked={ci.checked} onChange={() => onToggleChecklist(ci.id)} />
                    <span className={ci.checked ? 'done' : ''}>{ci.label}</span>
                    <button type="button" className="review-checklist-remove" title="Retirer" onClick={() => onRemoveChecklist(ci.id)}>✕</button>
                  </label>
                ))}
              </div>
            )}
            <form className="review-checklist-add" onSubmit={submitChecklist}>
              <input
                type="text"
                placeholder="Ajouter un point à vérifier…"
                value={newChecklistLabel}
                onChange={(e) => setNewChecklistLabel(e.target.value)}
              />
              <button type="submit" title="Ajouter">＋</button>
            </form>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function ReviewPage({ onBack, onOpenNote }: Props) {
  const trees = useStore((s) => s.trees);
  const setNotes = useStore((s) => s.setNotes);
  const [session, setSession] = useState<Session | null>(null);
  const [browseTreeId, setBrowseTreeId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('due');

  const allCards = useMemo(() => collectReviewCards(trees), [trees]);
  const dueCards = useMemo(() => allCards.filter((c) => isDue(c)), [allCards]);
  const decks = useMemo(() => groupByDeck(allCards), [allCards]);

  const visibleDecks = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? decks.filter((d) => d.treeName.toLowerCase().includes(q)) : decks;
    const sorted = [...list];
    if (sortBy === 'name') sorted.sort((a, b) => a.treeName.localeCompare(b.treeName));
    else if (sortBy === 'total') sorted.sort((a, b) => b.totalCount - a.totalCount);
    else sorted.sort((a, b) => b.dueCount - a.dueCount);
    return sorted;
  }, [decks, search, sortBy]);

  const browseTreeName = browseTreeId ? (decks.find((d) => d.treeId === browseTreeId)?.treeName ?? '') : '';
  const browseCards = useMemo(() => {
    if (!browseTreeId) return [];
    return allCards
      .filter((c) => c.treeId === browseTreeId)
      .sort((a, b) => {
        const aDue = isDue(a), bDue = isDue(b);
        if (aDue !== bDue) return aDue ? -1 : 1;
        return (a.review?.dueAt ?? 0) - (b.review?.dueAt ?? 0);
      });
  }, [allCards, browseTreeId]);

  /* Une session ne grandit jamais après son lancement : `ids` fige soit les
     N premières cartes dues d'un paquet, soit une seule carte choisie à la
     main dans la liste complète — d'où le filtre sur `allCards` (pas
     seulement les dues, pour pouvoir rouvrir une carte pas encore due). */
  const startSession = (treeId: string | null, treeName: string, only?: ReviewCard) => {
    const ids = only
      ? new Set([cardKey(only)])
      : new Set(dueCards.filter((c) => treeId === null || c.treeId === treeId).slice(0, SESSION_SIZE).map(cardKey));
    setSession({ treeId, treeName, ids });
  };

  const queue = session ? allCards.filter((c) => session.ids.has(cardKey(c))) : [];
  const current = queue[0] ?? null;

  const updateReviewItem = (
    card: Pick<ReviewCard, 'treeId' | 'nodeId' | 'itemId' | 'itemKind'>,
    updater: (it: CanvasTextItem | CanvasFrameItem) => CanvasTextItem | CanvasFrameItem,
  ) => {
    const tree = trees.find((t) => t.id === card.treeId);
    if (!tree) return;
    const noteData = tree.notes?.[card.nodeId];
    const canvas = getOrMigrateCanvas(noteData);
    const items = canvas.items.map((it) => {
      if (it.id !== card.itemId) return it;
      if (card.itemKind === 'text' && it.kind === 'text') return updater(it);
      if (card.itemKind === 'frame' && it.kind === 'frame') return updater(it);
      return it;
    });
    setNotes(card.treeId, card.nodeId, { ...noteData, canvas: { ...canvas, items } });
  };

  const answer = (card: ReviewCard, remembered: boolean, note: string) => {
    updateReviewItem(card, (it) => ({
      ...it,
      review: nextReviewState(it.review, remembered),
      reviewLog: [...(it.reviewLog ?? []), { id: newId('log'), date: Date.now(), note: note.trim(), remembered }],
    }));
  };

  const editLogEntry = (card: ReviewCard, logId: string, note: string) => {
    updateReviewItem(card, (it) => ({
      ...it,
      reviewLog: (it.reviewLog ?? []).map((e) => (e.id === logId ? { ...e, note: note.trim() } : e)),
    }));
  };

  const deleteLogEntry = (card: ReviewCard, logId: string) => {
    updateReviewItem(card, (it) => ({
      ...it,
      reviewLog: (it.reviewLog ?? []).filter((e) => e.id !== logId),
    }));
  };

  const toggleChecklistItem = (card: ReviewCard, itemId: string) => {
    updateReviewItem(card, (it) => ({
      ...it,
      weeklyChecklist: (it.weeklyChecklist ?? []).map((ci) => (ci.id === itemId ? { ...ci, checked: !ci.checked } : ci)),
    }));
  };

  const addChecklistItem = (card: ReviewCard, label: string) => {
    updateReviewItem(card, (it) => ({
      ...it,
      weeklyChecklist: [...(it.weeklyChecklist ?? []), { id: newId('cl'), label, checked: false }],
    }));
  };

  const removeChecklistItem = (card: ReviewCard, itemId: string) => {
    updateReviewItem(card, (it) => ({
      ...it,
      weeklyChecklist: (it.weeklyChecklist ?? []).filter((ci) => ci.id !== itemId),
    }));
  };

  const resetWeeklyChecklist = (card: ReviewCard) => {
    updateReviewItem(card, (it) => ({
      ...it,
      weeklyChecklist: (it.weeklyChecklist ?? []).map((ci) => ({ ...ci, checked: false })),
      weeklyChecklistResetAt: Date.now(),
    }));
  };

  const totalDue = dueCards.length;
  const browseDueCount = browseCards.filter((c) => isDue(c)).length;

  const goBack = () => {
    if (session) { setSession(null); return; }
    if (browseTreeId) { setBrowseTreeId(null); return; }
    onBack();
  };

  const headerTitle = session ? session.treeName : browseTreeId ? browseTreeName : 'Mode révision';
  const headerCount = session
    ? `${queue.length} restantes dans cette session`
    : browseTreeId
      ? `${browseDueCount} à réviser · ${browseCards.length} au total`
      : `${totalDue} à réviser · ${allCards.length} au total`;

  return (
    <div className="notes-editor review-page">
      <div className="note-header">
        <motion.button className="note-back" title="Retour" onClick={goBack} whileTap={{ scale: 0.93 }}>
          <IBack size={16} />
        </motion.button>
        <div className="review-title">
          <span>{headerTitle}</span>
          <span className="review-count">{headerCount}</span>
        </div>
      </div>

      <div className={`review-body${session && current ? ' review-body-session' : ''}`}>
        {!session && !browseTreeId && (
          allCards.length === 0 ? (
            <div className="review-empty">
              <div className="review-empty-emoji">🎉</div>
              <div className="review-empty-title">Rien à réviser pour l’instant</div>
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
                  <option value="due">Le plus à réviser</option>
                  <option value="name">Nom (A→Z)</option>
                  <option value="total">Total de cartes</option>
                </select>
              </div>

              <div className="review-deck-grid">
                <button
                  type="button"
                  className="review-deck-card review-deck-all"
                  disabled={totalDue === 0}
                  onClick={() => startSession(null, 'Toutes les constellations')}
                >
                  <span className="review-deck-name">Tout réviser</span>
                  <span className="review-deck-due">{totalDue}</span>
                  <span className="review-deck-sub">due{totalDue !== 1 ? 's' : ''} au total</span>
                </button>
                {visibleDecks.map((d) => (
                  <button
                    key={d.treeId}
                    type="button"
                    className="review-deck-card"
                    onClick={() => setBrowseTreeId(d.treeId)}
                  >
                    <span className="review-deck-name">{d.treeName}</span>
                    <span className={`review-deck-due${d.dueCount === 0 ? ' none' : ''}`}>{d.dueCount}</span>
                    <span className="review-deck-sub">due{d.dueCount !== 1 ? 's' : ''} · {d.totalCount} au total</span>
                  </button>
                ))}
                {visibleDecks.length === 0 && (
                  <div className="review-deck-empty">Aucune constellation ne correspond à "{search}".</div>
                )}
              </div>
            </div>
          )
        )}

        {!session && browseTreeId && (
          <div className="review-browse-screen">
            <div className="review-browse-header">
              <button
                type="button"
                className="review-btn known"
                disabled={browseDueCount === 0}
                onClick={() => startSession(browseTreeId, browseTreeName)}
              >
                Réviser les {browseDueCount} due{browseDueCount !== 1 ? 's' : ''}
              </button>
            </div>
            <div className="review-browse-list">
              {browseCards.map((c) => {
                const status = cardStatus(c);
                const badge = pacerBadge(c);
                return (
                  <button
                    key={cardKey(c)}
                    type="button"
                    className="review-browse-row"
                    onClick={() => startSession(browseTreeId, browseTreeName, c)}
                  >
                    <span className="review-browse-pacer" style={{ background: badge.color }}>{badge.short}</span>
                    <span className="review-browse-main">
                      <span className="review-browse-node">{c.nodeName}</span>
                      <span className="review-browse-excerpt">{truncate(c.text)}</span>
                    </span>
                    <span className={`review-browse-status${status.due ? ' due' : ''}`}>{status.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {session && !current && (
          <div className="review-empty">
            <div className="review-empty-emoji">✅</div>
            <div className="review-empty-title">Session terminée</div>
            <div className="review-empty-sub">
              {totalDue > 0
                ? 'Il reste encore des cartes dues — reprends une session pour continuer.'
                : 'Plus rien à réviser pour l’instant.'}
            </div>
            <button type="button" className="review-btn known" style={{ marginTop: 16 }} onClick={() => setSession(null)}>
              Retour à la liste
            </button>
          </div>
        )}

        {session && current && (
          <ReviewSessionCard
            key={cardKey(current)}
            card={current}
            onAnswer={(remembered, note) => answer(current, remembered, note)}
            onOpenNote={() => onOpenNote(current.treeId, current.nodeId)}
            onEditLog={(logId, note) => editLogEntry(current, logId, note)}
            onDeleteLog={(logId) => deleteLogEntry(current, logId)}
            onToggleChecklist={(itemId) => toggleChecklistItem(current, itemId)}
            onAddChecklist={(label) => addChecklistItem(current, label)}
            onRemoveChecklist={(itemId) => removeChecklistItem(current, itemId)}
            onResetWeeklyChecklist={() => resetWeeklyChecklist(current)}
          />
        )}
      </div>
    </div>
  );
}
