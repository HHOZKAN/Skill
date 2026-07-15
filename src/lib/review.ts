import type { JSONContent } from '@tiptap/react';
import type { PacerCode, Tree } from '../types';
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
}

export interface ReviewDeck {
  treeId: string;
  treeName: string;
  totalCount: number;
}

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
        });
      }
    }
  }
  return cards;
}

/* Regroupe les cartes par constellation, pour naviguer paquet par paquet
   plutôt que de tout mélanger — trié par nombre de sujets décroissant. */
export function groupByDeck(cards: ReviewCard[]): ReviewDeck[] {
  const byTree = new Map<string, ReviewDeck>();
  for (const c of cards) {
    let deck = byTree.get(c.treeId);
    if (!deck) {
      deck = { treeId: c.treeId, treeName: c.treeName, totalCount: 0 };
      byTree.set(c.treeId, deck);
    }
    deck.totalCount += 1;
  }
  return Array.from(byTree.values()).sort((a, b) => b.totalCount - a.totalCount);
}
