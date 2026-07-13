import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Starfield from './components/Starfield';
import HomeGalaxy from './components/HomeGalaxy';
import ConstellationView from './components/ConstellationView';
import NotesPage from './components/NotesPage';
import ReviewPage from './components/ReviewPage';
import { useStore } from './store/useStore';
import { loadFromSupabase } from './store/useStore';
import { useRoute } from './hooks/useRoute';
import { hasSupabase } from './lib/supabase';
import { ICloud } from './components/Icons';

const slide = {
  initial: { opacity: 0, x: 32 },
  animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: -32 },
  transition: { duration: 0.28, ease: 'easeOut' as const },
};

export default function App() {
  const { route, navigate } = useRoute();
  const trees       = useStore((s) => s.trees);
  const addTree     = useStore((s) => s.addTree);
  const deleteTree  = useStore((s) => s.deleteTree);
  const renameTree  = useStore((s) => s.renameTree);
  const moveTree    = useStore((s) => s.moveTree);
  const addNode     = useStore((s) => s.addNode);
  const moveNode    = useStore((s) => s.moveNode);
  const renameNode  = useStore((s) => s.renameNode);
  const setNodeState= useStore((s) => s.setNodeState);
  const deleteNode  = useStore((s) => s.deleteNode);
  const addLink     = useStore((s) => s.addLink);
  const deleteLink  = useStore((s) => s.deleteLink);
  const setNotes    = useStore((s) => s.setNotes);

  /* charge depuis Supabase si configuré */
  useEffect(() => { loadFromSupabase(); }, []);

  /* validation de route (arbre supprimé → home) */
  useEffect(() => {
    const treeById = (id: string) => trees.find((t) => t.id === id);
    if (route.view === 'tree' && !treeById(route.treeId)) navigate({ view: 'home' });
    if (route.view === 'note') {
      const t = treeById(route.treeId);
      if (!t || !t.nodes.some((n) => n.id === route.nodeId)) {
        navigate(t ? { view: 'tree', treeId: t.id } : { view: 'home' });
      }
    }
  }, [route, trees]);

  const treeById = (id: string) => trees.find((t) => t.id === id);

  return (
    <>
      <Starfield density={0.00006} />

      {/* badge sync cloud */}
      {hasSupabase && (
        <div style={{ position:'fixed', bottom:22, right:22, zIndex:50, display:'flex', alignItems:'center', gap:8, padding:'7px 14px', borderRadius:99, background:'rgba(20,28,54,0.7)', border:'1px solid rgba(180,200,240,0.16)', backdropFilter:'blur(8px)', fontSize:12, color:'oklch(0.7 0.028 252)', letterSpacing:'0.04em' }}>
          <ICloud size={13}/> sync activée
        </div>
      )}

      <AnimatePresence mode="wait">
        {route.view === 'home' && (
          <motion.div key="home" {...slide} style={{ position:'absolute',inset:0,zIndex:10 }}>
            <HomeGalaxy
              trees={trees}
              onOpen={(id) => navigate({ view: 'tree', treeId: id })}
              onCreate={(gx, gy) => addTree(gx, gy)}
              onRenameTree={(id, name) => renameTree(id, name)}
              onMoveTree={(id, gx, gy) => moveTree(id, gx, gy)}
              onDelete={(id) => deleteTree(id)}
              onOpenReview={() => navigate({ view: 'review' })}
            />
          </motion.div>
        )}

        {route.view === 'tree' && (() => {
          const tree = treeById(route.treeId);
          if (!tree) return null;
          return (
            <motion.div key={'tree-'+route.treeId} {...slide} style={{ position:'absolute',inset:0,zIndex:10 }}>
              <ConstellationView
                tree={tree}
                onHome={() => navigate({ view: 'home' })}
                onBack={() => navigate({ view: 'home' })}
                onOpenNote={(nodeId) => navigate({ view: 'note', treeId: tree.id, nodeId })}
                onRenameTree={(name) => renameTree(tree.id, name)}
                onAddNode={(node) => addNode(tree.id, node)}
                onMoveNode={(id, x, y) => moveNode(tree.id, id, x, y)}
                onRenameNode={(id, name) => renameNode(tree.id, id, name)}
                onSetState={(id, st) => setNodeState(tree.id, id, st)}
                onDeleteNode={(id) => deleteNode(tree.id, id)}
                onAddLink={(from, to) => addLink(tree.id, from, to)}
                onDeleteLink={(id) => deleteLink(tree.id, id)}
              />
            </motion.div>
          );
        })()}

        {route.view === 'review' && (
          <motion.div key="review" {...slide} style={{ position:'absolute',inset:0,zIndex:10 }}>
            <ReviewPage
              onBack={() => navigate({ view: 'home' })}
              onOpenNote={(treeId, nodeId) => navigate({ view: 'note', treeId, nodeId })}
            />
          </motion.div>
        )}

        {route.view === 'note' && (() => {
          const tree = treeById(route.treeId);
          const node = tree?.nodes.find((n) => n.id === route.nodeId);
          if (!tree || !node) return null;
          return (
            <motion.div key={'note-'+route.nodeId} {...slide} style={{ position:'absolute',inset:0,zIndex:10 }}>
              <NotesPage
                tree={tree}
                node={node}
                onBack={() => navigate({ view: 'tree', treeId: tree.id })}
                onSave={(nodeId, data) => setNotes(tree.id, nodeId, data)}
                onRename={(nodeId, name) => renameNode(tree.id, nodeId, name)}
                onNavigateToNote={(tid, nid) => navigate({ view: 'note', treeId: tid, nodeId: nid })}
              />
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </>
  );
}
