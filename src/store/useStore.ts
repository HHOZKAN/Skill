import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Tree, ConstellationNode, NoteData } from '../types';
import { uid } from '../lib/uid';
import { seedTrees } from '../lib/seed';
import { supabase } from '../lib/supabase';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */
interface StoreState {
  trees: Tree[];

  // Trees
  addTree: (gx: number, gy: number) => string;
  deleteTree: (id: string) => void;
  renameTree: (id: string, name: string) => void;
  moveTree: (id: string, gx: number, gy: number) => void;

  // Nodes
  addNode: (treeId: string, node: ConstellationNode) => void;
  moveNode: (treeId: string, id: string, x: number, y: number) => void;
  renameNode: (treeId: string, id: string, name: string) => void;
  setNodeState: (treeId: string, id: string, state: ConstellationNode['state']) => void;
  deleteNode: (treeId: string, id: string) => void;

  // Links
  addLink: (treeId: string, from: string, to: string) => void;
  deleteLink: (treeId: string, id: string) => void;

  // Notes
  setNotes: (treeId: string, nodeId: string, data: NoteData) => void;

  // Sync
  syncToSupabase: () => Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */
const mapTree = (trees: Tree[], id: string, fn: (t: Tree) => Tree): Tree[] =>
  trees.map((t) => (t.id === id ? fn(t) : t));

function ensureGalaxyLayout(trees: Tree[]): Tree[] {
  let i = 0;
  const placed = trees.filter((t) => typeof t.gx === 'number');
  return trees.map((t) => {
    if (typeof t.gx === 'number') return t;
    const k = placed.length + i++;
    const angle = k * 2.399963;
    const r = 380 + 300 * Math.sqrt(k);
    return { ...t, gx: Math.round(Math.cos(angle) * r), gy: Math.round(Math.sin(angle) * r) };
  });
}

/* ------------------------------------------------------------------ */
/*  Store                                                               */
/* ------------------------------------------------------------------ */
export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      trees: ensureGalaxyLayout(seedTrees()),

      /* ---- Trees ---- */
      addTree: (gx, gy) => {
        const tree: Tree = { id: uid('tree'), name: '', createdAt: Date.now(), gx, gy, nodes: [], links: [], notes: {} };
        set((s) => ({ trees: [...s.trees, tree] }));
        get().syncToSupabase();
        return tree.id;
      },
      deleteTree: (id) => {
        set((s) => ({ trees: s.trees.filter((t) => t.id !== id) }));
        get().syncToSupabase();
      },
      renameTree: (id, name) => {
        set((s) => ({ trees: mapTree(s.trees, id, (t) => ({ ...t, name })) }));
        get().syncToSupabase();
      },
      moveTree: (id, gx, gy) => {
        set((s) => ({ trees: mapTree(s.trees, id, (t) => ({ ...t, gx, gy })) }));
        get().syncToSupabase();
      },

      /* ---- Nodes ---- */
      addNode: (treeId, node) => {
        set((s) => ({ trees: mapTree(s.trees, treeId, (t) => ({ ...t, nodes: [...t.nodes, node] })) }));
        get().syncToSupabase();
      },
      moveNode: (treeId, id, x, y) => {
        set((s) => ({ trees: mapTree(s.trees, treeId, (t) => ({ ...t, nodes: t.nodes.map((n) => n.id === id ? { ...n, x, y } : n) })) }));
        get().syncToSupabase();
      },
      renameNode: (treeId, id, name) => {
        set((s) => ({ trees: mapTree(s.trees, treeId, (t) => ({ ...t, nodes: t.nodes.map((n) => n.id === id ? { ...n, name } : n) })) }));
        get().syncToSupabase();
      },
      setNodeState: (treeId, id, state) => {
        set((s) => ({ trees: mapTree(s.trees, treeId, (t) => ({ ...t, nodes: t.nodes.map((n) => n.id === id ? { ...n, state } : n) })) }));
        get().syncToSupabase();
      },
      deleteNode: (treeId, id) => {
        set((s) => ({ trees: mapTree(s.trees, treeId, (t) => {
          const notes = { ...(t.notes || {}) }; delete notes[id];
          return { ...t, nodes: t.nodes.filter((n) => n.id !== id), links: t.links.filter((l) => l.from !== id && l.to !== id), notes };
        }) }));
        get().syncToSupabase();
      },

      /* ---- Links ---- */
      addLink: (treeId, from, to) => {
        set((s) => ({ trees: mapTree(s.trees, treeId, (t) => {
          if (from === to) return t;
          const exists = t.links.some((l) => (l.from === from && l.to === to) || (l.from === to && l.to === from));
          if (exists) return t;
          return { ...t, links: [...t.links, { id: uid('l'), from, to }] };
        }) }));
        get().syncToSupabase();
      },
      deleteLink: (treeId, id) => {
        set((s) => ({ trees: mapTree(s.trees, treeId, (t) => ({ ...t, links: t.links.filter((l) => l.id !== id) })) }));
        get().syncToSupabase();
      },

      /* ---- Notes ---- */
      setNotes: (treeId, nodeId, data) => {
        set((s) => ({ trees: mapTree(s.trees, treeId, (t) => ({ ...t, notes: { ...(t.notes || {}), [nodeId]: data } })) }));
        get().syncToSupabase();
      },

      /* ---- Supabase sync (upsert full state) ---- */
      syncToSupabase: async () => {
        if (!supabase) return;
        const { trees } = get();
        await supabase
          .from('constellations_state')
          .upsert({ id: 'default', trees, updated_at: new Date().toISOString() });
      },
    }),
    {
      name: 'constellations.v2',
      onRehydrateStorage: () => (state) => {
        if (state && !state.trees?.length) {
          state.trees = ensureGalaxyLayout(seedTrees());
        }
      },
    }
  )
);

/* ---- Load from Supabase on boot (if configured) ---- */
export async function loadFromSupabase() {
  if (!supabase) return;
  const { data } = await supabase
    .from('constellations_state')
    .select('trees')
    .eq('id', 'default')
    .single();
  if (data?.trees) {
    useStore.setState({ trees: ensureGalaxyLayout(data.trees) });
  }
}
