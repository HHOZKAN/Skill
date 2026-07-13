import type { JSONContent } from '@tiptap/react';
import type { ChecklistItem, PacerCode, ReviewLogEntry, ReviewState, Tree } from '../types';
import { getOrMigrateCanvas } from './canvas';
import { worldRectOf, isFullyInside } from './geometry';

export interface ReviewCard {
  treeId: string;
  treeName: string;
  nodeId: string;
  nodeName: string;
  itemId: string;
  itemKind: 'text' | 'frame';
  pacer?: PacerCode;
  text: string;
  review?: ReviewState;
  reviewLog: ReviewLogEntry[];
  weeklyChecklist: ChecklistItem[];
  weeklyChecklistResetAt?: number;
}

export interface ReviewDeck {
  treeId: string;
  treeName: string;
  dueCount: number;
  totalCount: number;
}

const MIN_INTERVAL_DAYS = 1;
const MAX_INTERVAL_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;
export const SESSION_SIZE = 20;
export const WEEK_MS = 7 * DAY_MS;

function extractPlainText(content: JSONContent | undefined): string {
  if (!content) return '';
  const parts: string[] = [];
  const walk = (node: JSONContent) => {
    if (node.type === 'text' && node.text) parts.push(node.text);
    node.content?.forEach(walk);
  };
  walk(content);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/* Parcourt tout l'atlas pour rassembler :
   - les blocs "Référence" et "Evidence" (PACER), à réviser un par un ;
   - les cadres marqués "à réviser", qui regroupent tout leur contenu en un
     seul sujet plutôt que de l'éclater bloc par bloc. */
export function collectReviewCards(trees: Tree[]): ReviewCard[] {
  const cards: ReviewCard[] = [];
  for (const tree of trees) {
    for (const node of tree.nodes) {
      const canvas = getOrMigrateCanvas(tree.notes?.[node.id]);

      for (const it of canvas.items) {
        if (it.kind !== 'text' || (it.pacer !== 'R' && it.pacer !== 'E')) continue;
        const text = extractPlainText(it.content);
        if (!text) continue;
        cards.push({
          treeId: tree.id,
          treeName: tree.name || 'Sans titre',
          nodeId: node.id,
          nodeName: node.name || 'Sans titre',
          itemId: it.id,
          itemKind: 'text',
          pacer: it.pacer,
          text,
          review: it.review,
          reviewLog: it.reviewLog ?? [],
          weeklyChecklist: it.weeklyChecklist ?? [],
          weeklyChecklistResetAt: it.weeklyChecklistResetAt,
        });
      }

      for (const frame of canvas.items) {
        if (frame.kind !== 'frame' || !frame.reviewEnabled) continue;
        const frameRect = worldRectOf(frame);
        const contained = canvas.items.filter(
          (it) => it.id !== frame.id && it.kind === 'text' && isFullyInside(worldRectOf(it), frameRect),
        );
        const text = contained
          .map((it) => (it.kind === 'text' ? extractPlainText(it.content) : ''))
          .filter(Boolean)
          .join('\n\n');
        if (!text) continue;
        cards.push({
          treeId: tree.id,
          treeName: tree.name || 'Sans titre',
          nodeId: node.id,
          nodeName: node.name || 'Sans titre',
          itemId: frame.id,
          itemKind: 'frame',
          text,
          review: frame.review,
          reviewLog: frame.reviewLog ?? [],
          weeklyChecklist: frame.weeklyChecklist ?? [],
          weeklyChecklistResetAt: frame.weeklyChecklistResetAt,
        });
      }
    }
  }
  return cards;
}

export function isDue(card: Pick<ReviewCard, 'review'>, now = Date.now()): boolean {
  return !card.review || card.review.dueAt <= now;
}

/* Regroupe les cartes par constellation, pour choisir un « paquet » à réviser
   plutôt que de tout mélanger — trié par nombre de cartes dues décroissant. */
export function groupByDeck(cards: ReviewCard[]): ReviewDeck[] {
  const byTree = new Map<string, ReviewDeck>();
  for (const c of cards) {
    let deck = byTree.get(c.treeId);
    if (!deck) {
      deck = { treeId: c.treeId, treeName: c.treeName, dueCount: 0, totalCount: 0 };
      byTree.set(c.treeId, deck);
    }
    deck.totalCount += 1;
    if (isDue(c)) deck.dueCount += 1;
  }
  return Array.from(byTree.values()).sort((a, b) => b.dueCount - a.dueCount);
}

/* Répétition espacée simplifiée (façon SM-2 sans facteur de facilité) :
   oublié → on revoit demain ; su → l'intervalle double (plafonné). */
export function nextReviewState(current: ReviewState | undefined, remembered: boolean, now = Date.now()): ReviewState {
  if (!remembered) {
    return { intervalDays: MIN_INTERVAL_DAYS, dueAt: now + MIN_INTERVAL_DAYS * DAY_MS };
  }
  const intervalDays = Math.min(MAX_INTERVAL_DAYS, Math.max(MIN_INTERVAL_DAYS, (current?.intervalDays ?? 0) * 2 || MIN_INTERVAL_DAYS));
  return { intervalDays, dueAt: now + intervalDays * DAY_MS };
}
