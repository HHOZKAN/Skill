import type { JSONContent } from '@tiptap/react';
import type { Tree } from '../types';
import { getOrMigrateCanvas } from './canvas';

export interface Backlink {
  treeId: string;
  treeName: string;
  nodeId: string;
  nodeName: string;
}

function hasMentionTo(content: JSONContent | undefined, treeId: string, nodeId: string): boolean {
  if (!content) return false;
  if (content.type === 'noteMention' && content.attrs?.treeId === treeId && content.attrs?.nodeId === nodeId) {
    return true;
  }
  return (content.content ?? []).some((c) => hasMentionTo(c, treeId, nodeId));
}

/* Parcourt toutes les notes de l'atlas pour trouver celles qui mentionnent
   (treeId, nodeId) — un lien entrant par note source, même si elle contient
   plusieurs mentions vers la même cible. */
export function findBacklinks(trees: Tree[], treeId: string, nodeId: string): Backlink[] {
  const results: Backlink[] = [];
  for (const tree of trees) {
    for (const node of tree.nodes) {
      if (tree.id === treeId && node.id === nodeId) continue;
      const canvas = getOrMigrateCanvas(tree.notes?.[node.id]);
      const found = canvas.items.some(
        (it) => it.kind === 'text' && hasMentionTo(it.content, treeId, nodeId),
      );
      if (found) {
        results.push({ treeId: tree.id, treeName: tree.name || 'Sans titre', nodeId: node.id, nodeName: node.name || 'Sans titre' });
      }
    }
  }
  return results;
}
