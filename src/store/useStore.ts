import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Tree, ConstellationNode, NoteData } from '../types';
import { uid } from '../lib/uid';
import { seedTrees } from '../lib/seed';
import { supabase } from '../lib/supabase';
import { isDataUrl, uploadDataUrl } from '../lib/images';

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
  syncToSupabase: () => void;
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

      /* ---- Supabase sync : planifie un envoi débouncé (voir scheduleSync) ---- */
      syncToSupabase: () => scheduleSync(get),
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

/* ------------------------------------------------------------------ */
/*  Synchronisation cloud (par utilisateur, débouncée)                  */
/* ------------------------------------------------------------------ */
const SYNC_DEBOUNCE_MS = 1200;
let syncTimer: ReturnType<typeof setTimeout> | null = null;

async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/* Upsert la ligne de l'utilisateur courant. Silencieux hors ligne / non
   connecté : la copie localStorage reste la source de secours. */
async function pushState(trees: Tree[]) {
  if (!supabase) return;
  const userId = await currentUserId();
  if (!userId) return;
  await supabase.from('atlas_state').upsert({
    user_id: userId,
    trees,
    updated_at: new Date().toISOString(),
  });
}

function scheduleSync(get: () => StoreState) {
  if (!supabase) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void pushState(get().trees);
  }, SYNC_DEBOUNCE_MS);
}

/* Envoi immédiat de tout changement en attente (fermeture d'onglet…). */
export function flushSync() {
  if (!supabase || !syncTimer) return;
  clearTimeout(syncTimer);
  syncTimer = null;
  void pushState(useStore.getState().trees);
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushSync);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSync();
  });
}

/* ------------------------------------------------------------------ */
/*  Chargement depuis Supabase (à appeler une fois connecté)            */
/* ------------------------------------------------------------------ */
export async function loadFromSupabase() {
  if (!supabase) return;
  const userId = await currentUserId();
  if (!userId) return;

  const { data } = await supabase
    .from('atlas_state')
    .select('trees')
    .eq('user_id', userId)
    .maybeSingle();

  if (data?.trees && Array.isArray(data.trees) && data.trees.length) {
    // La base fait foi (synchro entre appareils).
    useStore.setState({ trees: ensureGalaxyLayout(data.trees as Tree[]) });
  } else {
    // Base vide → on y pousse l'état local existant (première migration).
    await pushState(useStore.getState().trees);
  }

  void migrateInlineImages();
}

/* Déplace vers Storage les images encore encodées en base64 dans les notes
   (anciennes données), et remplace leur src par l'URL publique. */
async function migrateInlineImages() {
  if (!supabase) return;
  const trees = useStore.getState().trees;
  let changed = false;

  const next = await Promise.all(
    trees.map(async (t) => {
      if (!t.notes) return t;
      const notes: Tree['notes'] = { ...t.notes };
      for (const nodeId of Object.keys(notes)) {
        const canvas = notes[nodeId]?.canvas;
        if (!canvas) continue;
        const items = await Promise.all(
          canvas.items.map(async (it) => {
            if (it.kind === 'image' && isDataUrl(it.src)) {
              const url = await uploadDataUrl(it.src);
              if (url) { changed = true; return { ...it, src: url }; }
            }
            return it;
          }),
        );
        notes[nodeId] = { ...notes[nodeId], canvas: { ...canvas, items } };
      }
      return { ...t, notes };
    }),
  );

  if (changed) {
    useStore.setState({ trees: next });
    void pushState(next);
  }
}
