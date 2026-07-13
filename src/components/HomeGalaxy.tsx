import { useMemo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IX, IPlus, IMinus, IExpand } from './Icons';
import type { Tree } from '../types';
import { collectReviewCards, isDue } from '../lib/review';

const CLUSTER_TARGET = 230;

function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }
function hashNum(id: string, mod: number) { return parseInt(id.replace(/\D/g,'').slice(-3) || '0', 10) % mod; }

interface ClusterStar { id: string; x: number; y: number; state: string; empty?: boolean }
interface ClusterLink { id: string; x1: number; y1: number; x2: number; y2: number; warm: boolean }
interface Cluster {
  tree: Tree; gx: number; gy: number;
  counts: Record<string, number>;
  stars: ClusterStar[]; links: ClusterLink[];
  bb: { minX: number; maxX: number; minY: number; maxY: number; cx: number; cy: number };
}

function computeCluster(tree: Tree, gx: number, gy: number): Cluster {
  const counts = { todo: 0, doing: 0, done: 0 };
  tree.nodes.forEach((n) => counts[n.state as keyof typeof counts]++);
  if (!tree.nodes.length) {
    return { tree, gx, gy, counts, stars: [{ id: tree.id+'_e', x:gx, y:gy, state:'todo', empty:true }], links: [], bb:{ minX:gx-70,maxX:gx+70,minY:gy-70,maxY:gy+70,cx:gx,cy:gy } };
  }
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  tree.nodes.forEach((n)=>{ minX=Math.min(minX,n.x);maxX=Math.max(maxX,n.x);minY=Math.min(minY,n.y);maxY=Math.max(maxY,n.y); });
  const lw=Math.max(1,maxX-minX),lh=Math.max(1,maxY-minY);
  const lcx=(minX+maxX)/2,lcy=(minY+maxY)/2;
  const k=clamp(CLUSTER_TARGET/Math.max(lw,lh),0.12,0.5);
  const byId: Record<string,ClusterStar> = {};
  const stars = tree.nodes.map((n)=>{ const s={id:n.id,x:gx+(n.x-lcx)*k,y:gy+(n.y-lcy)*k,state:n.state}; byId[n.id]=s; return s; });
  const links = tree.links.map((l)=>{ const a=byId[l.from],b=byId[l.to]; if(!a||!b) return null; const warm=tree.nodes.find((n)=>n.id===l.from)?.state==='done'&&tree.nodes.find((n)=>n.id===l.to)?.state==='done'; return {id:l.id,x1:a.x,y1:a.y,x2:b.x,y2:b.y,warm:!!warm}; }).filter(Boolean) as ClusterLink[];
  let mnx=Infinity,mny=Infinity,mxx=-Infinity,mxy=-Infinity;
  stars.forEach((s)=>{ mnx=Math.min(mnx,s.x);mny=Math.min(mny,s.y);mxx=Math.max(mxx,s.x);mxy=Math.max(mxy,s.y); });
  return { tree,gx,gy,counts,stars,links,bb:{minX:mnx,maxX:mxx,minY:mny,maxY:mxy,cx:(mnx+mxx)/2,cy:(mny+mxy)/2} };
}

interface Props {
  trees: Tree[];
  onOpen: (id: string) => void;
  onCreate: (gx: number, gy: number) => string;
  onRenameTree: (id: string, name: string) => void;
  onMoveTree: (id: string, gx: number, gy: number) => void;
  onDelete: (id: string) => void;
  onOpenReview: () => void;
}

export default function HomeGalaxy({ trees, onOpen, onCreate, onRenameTree, onMoveTree, onDelete, onOpenReview }: Props) {
  const dueReviewCount = useMemo(() => collectReviewCards(trees).filter((c) => isDue(c)).length, [trees]);
  const stageRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef({ x: 0, y: 0, scale: 1 });
  const [view, _setView] = useState({ x: 0, y: 0, scale: 1 });
  const setView = (v: typeof view | ((prev: typeof view) => typeof view)) => {
    const nv = typeof v === 'function' ? v(viewRef.current) : v;
    viewRef.current = nv; _setView(nv);
  };
  const [hovered, setHovered] = useState<string | null>(null);
  const [liveTree, setLiveTree] = useState<{ id: string; gx: number; gy: number } | null>(null);
  const liveRef = useRef(liveTree); useEffect(() => { liveRef.current = liveTree; }, [liveTree]);
  const [naming, setNaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [toDelete, setToDelete] = useState<Tree | null>(null);
  const [panning, setPanning] = useState(false);
  const gesture = useRef<any>(null);
  const fitted = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const clusters = trees.map((t) => {
    const lt = liveTree?.id === t.id ? liveTree : null;
    return computeCluster(t, lt ? lt.gx : t.gx, lt ? lt.gy : t.gy);
  });

  function toWorld(clientX: number, clientY: number) {
    const rect = stageRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX - rect.left - v.x) / v.scale, y: (clientY - rect.top - v.y) / v.scale };
  }
  function screenOf(wx: number, wy: number) { return { x: view.x + wx * view.scale, y: view.y + wy * view.scale }; }
  function clusterAt(wx: number, wy: number) {
    let best: Cluster | null = null, bestD = Infinity;
    for (const c of clusters) {
      const pad = 46;
      if (wx>=c.bb.minX-pad&&wx<=c.bb.maxX+pad&&wy>=c.bb.minY-pad&&wy<=c.bb.maxY+pad) {
        const d = Math.hypot(wx-c.bb.cx,wy-c.bb.cy);
        if (d<bestD) { bestD=d; best=c; }
      }
    }
    return best;
  }

  function fitAll() {
    const stage = stageRef.current; if (!stage) return;
    const rect = stage.getBoundingClientRect();
    if (!clusters.length) { setView({ x: rect.width/2, y: rect.height/2, scale: 1 }); return; }
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    clusters.forEach((c)=>{ minX=Math.min(minX,c.bb.minX);minY=Math.min(minY,c.bb.minY);maxX=Math.max(maxX,c.bb.maxX);maxY=Math.max(maxY,c.bb.maxY); });
    const bw=Math.max(1,maxX-minX),bh=Math.max(1,maxY-minY);
    const scale=clamp(Math.min((rect.width-320)/bw,(rect.height-280)/bh),0.18,1.2);
    setView({ x: rect.width/2-((minX+maxX)/2)*scale, y: rect.height/2-((minY+maxY)/2)*scale, scale });
  }
  useEffect(() => { if (!fitted.current) { fitted.current=true; fitAll(); } }, []);

  useEffect(() => {
    const stage = stageRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = stage.getBoundingClientRect();
      const cx=e.clientX-rect.left, cy=e.clientY-rect.top;
      const v = viewRef.current;
      const ns=clamp(v.scale*Math.exp(-e.deltaY*0.0012),0.1,4);
      const wx=(cx-v.x)/v.scale, wy=(cy-v.y)/v.scale;
      setView({ x:cx-wx*ns, y:cy-wy*ns, scale:ns });
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, []);

  const moveRef = useRef<(e: PointerEvent) => void>(() => {});
  const upRef   = useRef<(e: PointerEvent) => void>(() => {});
  function onMove(e: PointerEvent) {
    const g = gesture.current; if (!g) return;
    const dx=e.clientX-g.startX, dy=e.clientY-g.startY;
    if (!g.moved && Math.hypot(dx,dy)>4) g.moved=true;
    if (g.type==='pan') setView({ x:g.vx+dx, y:g.vy+dy, scale:viewRef.current.scale });
    else if (g.type==='dragtree') { const s=viewRef.current.scale; setLiveTree({ id:g.id, gx:Math.round(g.gx+dx/s), gy:Math.round(g.gy+dy/s) }); }
  }
  function onUp(e: PointerEvent) {
    const g = gesture.current; if (!g) return; gesture.current=null;
    if (g.type==='pan') setPanning(false);
    else if (g.type==='dragtree') {
      if (g.moved) { const s=viewRef.current.scale; onMoveTree(g.id,Math.round(g.gx+(e.clientX-g.startX)/s),Math.round(g.gy+(e.clientY-g.startY)/s)); }
      else if (naming!==g.id) onOpen(g.id);
      setLiveTree(null);
    }
  }
  moveRef.current=onMove; upRef.current=onUp;
  useEffect(() => {
    const m = (e: PointerEvent) => moveRef.current(e);
    const u = (e: PointerEvent) => upRef.current(e);
    window.addEventListener('pointermove', m);
    window.addEventListener('pointerup', u);
    return () => { window.removeEventListener('pointermove', m); window.removeEventListener('pointerup', u); };
  }, []);

  function onStageDown(e: React.PointerEvent) {
    if (e.button!==0) return;
    if ((e.target as HTMLElement).closest('.gx-overlay')) return;
    const w=toWorld(e.clientX,e.clientY);
    const c=clusterAt(w.x,w.y);
    if (c) gesture.current={type:'dragtree',id:c.tree.id,gx:c.gx,gy:c.gy,startX:e.clientX,startY:e.clientY,moved:false};
    else { setPanning(true); gesture.current={type:'pan',vx:viewRef.current.x,vy:viewRef.current.y,startX:e.clientX,startY:e.clientY,moved:false}; }
  }
  function onStageDouble(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('.gx-overlay')) return;
    const w=toWorld(e.clientX,e.clientY);
    if (clusterAt(w.x,w.y)) return;
    createAt(w.x,w.y);
  }
  function createAt(wx: number, wy: number) {
    const id=onCreate(Math.round(wx),Math.round(wy)); setNaming(id); setRenameVal('');
  }
  function createCenter() {
    const rect=stageRef.current!.getBoundingClientRect();
    const w=toWorld(rect.left+rect.width/2,rect.top+rect.height/2);
    createAt(w.x,w.y);
  }
  function commitName() {
    if (!naming) return;
    const v=renameVal.trim();
    if (v) { onRenameTree(naming,v); setNaming(null); }
    else { onDelete(naming); setNaming(null); }
  }
  useEffect(() => { if (naming && nameRef.current) nameRef.current.focus(); }, [naming]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { const tag=(e.target as HTMLElement).tagName?.toLowerCase(); if (tag==='input'||e.target instanceof HTMLElement&&e.target.isContentEditable) return; if (e.key==='Escape' && naming) commitName(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [naming, renameVal]);

  function zoomBy(f: number) {
    const rect=stageRef.current!.getBoundingClientRect();
    const cx=rect.width/2,cy=rect.height/2;
    const v=viewRef.current;
    const ns=clamp(v.scale*f,0.1,4);
    const wx=(cx-v.x)/v.scale,wy=(cy-v.y)/v.scale;
    setView({ x:cx-wx*ns, y:cy-wy*ns, scale:ns });
  }

  const cursor = panning ? 'grabbing' : hovered ? 'pointer' : 'grab';

  return (
    <div className="constellation galaxy-view">
      {/* topbar */}
      <div className="topbar">
        <div className="brand">
          <span className="mark">Constellations</span>
          <span className="sub">atlas des savoirs</span>
        </div>
        <div className="spacer" />
        <button type="button" className="chip chip-btn" onClick={onOpenReview} title="Réviser les blocs Référence / Evidence">
          Mode révision
          {dueReviewCount > 0 && <span className="chip-badge">{dueReviewCount}</span>}
        </button>
        <div className="chip">{trees.length} constellation{trees.length !== 1 ? 's' : ''}</div>
      </div>

      {/* stage */}
      <div
        ref={stageRef}
        className={`canvas-stage${panning ? ' panning' : ''}`}
        style={{ cursor }}
        onPointerDown={onStageDown}
        onPointerMove={(e) => {
          if (gesture.current) return;
          const w=toWorld(e.clientX,e.clientY);
          const c=clusterAt(w.x,w.y);
          const id=c?c.tree.id:null;
          if (id!==hovered) setHovered(id);
        }}
        onDoubleClick={onStageDouble}
      >
        <div className="world" style={{ transform: `translate(${view.x}px,${view.y}px) scale(${view.scale})` }}>
          {/* halos */}
          {clusters.map((c) => {
            const w=(c.bb.maxX-c.bb.minX)+180,h=(c.bb.maxY-c.bb.minY)+180;
            return <div key={'h_'+c.tree.id} className={`cluster-halo${hovered===c.tree.id?' hot':''}`} style={{ left:c.bb.cx, top:c.bb.cy, width:Math.max(220,w), height:Math.max(220,h) }} />;
          })}
          {/* links */}
          <svg className="links-svg" style={{ overflow:'visible' }} width={1} height={1}>
            {clusters.flatMap((c) => c.links.map((l) => (
              <g key={c.tree.id+l.id}>
                <line className={`link-glow${l.warm?' warm':''}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
                <line className={`link-line${l.warm?' warm':''}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
              </g>
            )))}
          </svg>
          {/* stars */}
          {clusters.flatMap((c) => c.stars.map((s) => (
            <div key={c.tree.id+s.id} className={`star ${s.state}${s.empty?' empty':''}`}
              style={{ left:s.x, top:s.y, ['--tw' as any]:(3+hashNum(s.id,18)/6)+'s', ['--dl' as any]:(hashNum(s.id,40)/10)+'s', pointerEvents:'none' }}>
              <span className="star-core" />
            </div>
          )))}
        </div>

        {/* overlay labels */}
        <div className="gx-overlay">
          {clusters.map((c) => {
            const s=screenOf(c.bb.cx,c.bb.maxY);
            const hot=hovered===c.tree.id;
            if (naming===c.tree.id) {
              const sc=screenOf(c.bb.cx,c.bb.cy);
              return (
                <div key={'n_'+c.tree.id} className="gx-name" style={{ left:sc.x, top:sc.y }} onPointerDown={(e)=>e.stopPropagation()}>
                  <input ref={nameRef} value={renameVal} placeholder="Nommer la constellation"
                    onChange={(e)=>setRenameVal(e.target.value)}
                    onBlur={commitName}
                    onKeyDown={(e)=>{ if (e.key==='Enter') commitName(); }} />
                </div>
              );
            }
            return (
              <div key={'l_'+c.tree.id} className={`cluster-label${hot?' hot':''}`}
                style={{ left:s.x, top:s.y+18 }}
                onPointerDown={(e)=>e.stopPropagation()}
                onClick={()=>onOpen(c.tree.id)}
                onMouseEnter={()=>setHovered(c.tree.id)}
                onMouseLeave={()=>setHovered((h)=>h===c.tree.id?null:h)}>
                <div className="cl-name">{c.tree.name||'Sans titre'}</div>
                <div className="cl-meta">
                  <span>{c.tree.nodes.length} compétence{c.tree.nodes.length!==1?'s':''}</span>
                  {c.counts.done>0 && <span className="cl-seg"><span className="dot done"/>{c.counts.done}</span>}
                </div>
                <button className="cl-del" title="Supprimer" onPointerDown={(e)=>e.stopPropagation()} onClick={(e)=>{ e.stopPropagation(); setToDelete(c.tree); }}>
                  <IX size={13}/>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* empty hint */}
      {!trees.length && (
        <div className="empty-hint">
          <div className="inner">
            <div className="big">Un ciel encore vierge</div>
            <div style={{ fontSize:14 }}>Double-cliquez n'importe où pour créer votre première constellation</div>
          </div>
        </div>
      )}

      {/* dock */}
      <div className="dock" onPointerDown={(e)=>e.stopPropagation()}>
        <button className="d-btn primary" onClick={createCenter}><IPlus size={16}/> Nouvelle constellation</button>
        <span className="d-sep"/>
        <button className="d-btn" title="Dézoomer" onClick={()=>zoomBy(1/1.3)}><IMinus size={16}/></button>
        <span className="zoom-val">{Math.round(view.scale*100)}%</span>
        <button className="d-btn" title="Zoomer" onClick={()=>zoomBy(1.3)}><IPlus size={16}/></button>
        <button className="d-btn" title="Tout afficher" onClick={fitAll}><IExpand size={16}/></button>
      </div>

      {/* delete modal */}
      <AnimatePresence>
        {toDelete && (
          <motion.div className="scrim" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onPointerDown={(e)=>e.stopPropagation()} onClick={()=>setToDelete(null)}>
            <motion.div className="modal" initial={{ scale:0.92,opacity:0 }} animate={{ scale:1,opacity:1 }} exit={{ scale:0.92,opacity:0 }}
              transition={{ type:'spring',stiffness:400,damping:28 }} onClick={(e)=>e.stopPropagation()}>
              <h3>Dissiper cette constellation ?</h3>
              <p>« {toDelete.name||'Sans titre'} » et toutes ses compétences, liens et notes seront définitivement effacés du ciel.</p>
              <div className="actions">
                <button className="btn ghost" onClick={()=>setToDelete(null)}>Garder</button>
                <button className="btn danger" onClick={()=>{ onDelete(toDelete.id); setToDelete(null); }}>Supprimer</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
