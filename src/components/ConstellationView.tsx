import { useState, useRef, useEffect, useMemo, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IHome, IPlus, IMinus, ILink, IEdit, INote, ITrash, IRecenter } from './Icons';
import { uid } from '../lib/uid';
import type { Tree, ConstellationNode } from '../types';

const STATES = ['todo', 'doing', 'done'] as const;
const STATE_LABEL = { todo: 'À commencer', doing: 'En cours', done: 'Maîtrisée' };

/* Geste souris en cours sur la scène (pan / déplacement d'étoile / lien). */
type Gesture =
  | { type: 'pan'; viewX: number; viewY: number; startX: number; startY: number; moved: boolean }
  | { type: 'dragnode'; id: string; nodeX: number; nodeY: number; startX: number; startY: number; moved: boolean }
  | { type: 'connect'; id: string; startX: number; startY: number; moved: boolean };

function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }

interface Props {
  tree: Tree;
  onHome: () => void;
  onBack: () => void;
  onOpenNote: (nodeId: string) => void;
  onRenameTree: (name: string) => void;
  onAddNode: (node: ConstellationNode) => void;
  onMoveNode: (id: string, x: number, y: number) => void;
  onRenameNode: (id: string, name: string) => void;
  onSetState: (id: string, state: ConstellationNode['state']) => void;
  onDeleteNode: (id: string) => void;
  onAddLink: (from: string, to: string) => void;
  onDeleteLink: (id: string) => void;
}

export default function ConstellationView(props: Props) {
  const { tree, onHome, onOpenNote, onRenameTree, onAddNode, onMoveNode, onRenameNode, onSetState, onDeleteNode, onAddLink, onDeleteLink } = props;

  const stageRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef({ x: 0, y: 0, scale: 1 });
  const [view, _setView] = useState({ x: 0, y: 0, scale: 1 });
  const setView = (v: typeof view | ((p: typeof view) => typeof view)) => { const nv = typeof v === 'function' ? v(viewRef.current) : v; viewRef.current = nv; _setView(nv); };

  const [sel, setSel] = useState<{ type: 'node' | 'link'; id: string } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [live, setLive] = useState<{ id: string; x: number; y: number } | null>(null);
  const liveRef = useRef(live); useEffect(() => { liveRef.current = live; }, [live]);
  const [linkMode, setLinkMode] = useState(false);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [temp, setTemp] = useState<{ fromId: string; x: number; y: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  const fittedFor = useRef<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const nodesById = useMemo(() => { const m: Record<string, ConstellationNode> = {}; tree.nodes.forEach((n) => { m[n.id] = n; }); return m; }, [tree.nodes]);
  function nodePos(n: ConstellationNode) { return live?.id === n.id ? { x: live.x, y: live.y } : { x: n.x, y: n.y }; }

  function toWorld(clientX: number, clientY: number) {
    const rect = stageRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX - rect.left - v.x) / v.scale, y: (clientY - rect.top - v.y) / v.scale };
  }

  function fitView() {
    const stage = stageRef.current; if (!stage) return;
    const rect = stage.getBoundingClientRect();
    if (!tree.nodes.length) { setView({ x: rect.width/2, y: rect.height/2, scale: 1 }); return; }
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    tree.nodes.forEach((n)=>{ minX=Math.min(minX,n.x);maxX=Math.max(maxX,n.x);minY=Math.min(minY,n.y);maxY=Math.max(maxY,n.y); });
    const bw=Math.max(1,maxX-minX),bh=Math.max(1,maxY-minY);
    const scale=clamp(Math.min((rect.width-360)/ bw,(rect.height-300)/bh),0.3,1.4);
    setView({ x:rect.width/2-((minX+maxX)/2)*scale, y:rect.height/2-((minY+maxY)/2)*scale, scale });
  }
  useEffect(() => { if (fittedFor.current!==tree.id) { fittedFor.current=tree.id; fitView(); } }, [tree.id]);

  useEffect(() => {
    const stage = stageRef.current!;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); const rect=stage.getBoundingClientRect(); const cx=e.clientX-rect.left,cy=e.clientY-rect.top; const v=viewRef.current; const ns=clamp(v.scale*Math.exp(-e.deltaY*0.0012),0.25,3); const wx=(cx-v.x)/v.scale,wy=(cy-v.y)/v.scale; setView({ x:cx-wx*ns,y:cy-wy*ns,scale:ns }); };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, []);

  const moveRef = useRef<(e: PointerEvent) => void>(() => {});
  const upRef   = useRef<(e: PointerEvent) => void>(() => {});
  function onMove(e: PointerEvent) {
    const g=gesture.current; if (!g) return;
    const dx=e.clientX-g.startX,dy=e.clientY-g.startY;
    if (!g.moved&&Math.hypot(dx,dy)>4) g.moved=true;
    if (g.type==='pan') setView({ x:g.viewX+dx,y:g.viewY+dy,scale:viewRef.current.scale });
    else if (g.type==='dragnode') { const s=viewRef.current.scale; setLive({ id:g.id,x:g.nodeX+dx/s,y:g.nodeY+dy/s }); }
    else if (g.type==='connect') { const w=toWorld(e.clientX,e.clientY); setTemp({ fromId:g.id,x:w.x,y:w.y }); }
  }
  function onUp(e: PointerEvent) {
    const g=gesture.current; if (!g) return; gesture.current=null;
    if (g.type==='pan') { setPanning(false); if (!g.moved) { setSel(null); setRenaming(null); } }
    else if (g.type==='dragnode') { if (g.moved) { const s=viewRef.current.scale; onMoveNode(g.id,Math.round(g.nodeX+(e.clientX-g.startX)/s),Math.round(g.nodeY+(e.clientY-g.startY)/s)); } else setSel({ type:'node',id:g.id }); setLive(null); }
    else if (g.type==='connect') { const el=document.elementFromPoint(e.clientX,e.clientY); const star=el&&(el as HTMLElement).closest?.('.star'); const targetId=star?.getAttribute('data-node-id'); if (targetId&&targetId!==g.id) onAddLink(g.id,targetId); setTemp(null); }
  }
  moveRef.current=onMove; upRef.current=onUp;
  useEffect(() => { const m=(e:PointerEvent)=>moveRef.current(e); const u=(e:PointerEvent)=>upRef.current(e); window.addEventListener('pointermove',m); window.addEventListener('pointerup',u); return ()=>{ window.removeEventListener('pointermove',m); window.removeEventListener('pointerup',u); }; }, []);

  function onStagePointerDown(e: React.PointerEvent) {
    if (e.button!==0) return;
    setPanning(true);
    gesture.current={type:'pan',viewX:viewRef.current.x,viewY:viewRef.current.y,startX:e.clientX,startY:e.clientY,moved:false};
  }
  function onStageDoubleClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('.star')||(e.target as HTMLElement).closest('.link-hit')) return;
    const w=toWorld(e.clientX,e.clientY); addStarAt(w.x,w.y);
  }

  function addStarAt(x: number, y: number) {
    const id=uid('n');
    onAddNode({ id, name:'', x:Math.round(x), y:Math.round(y), state:'todo' });
    setSel({ type:'node',id }); setRenaming(id); setRenameVal('');
  }
  function addStarCenter() {
    const rect=stageRef.current!.getBoundingClientRect();
    const w=toWorld(rect.left+rect.width/2,rect.top+rect.height/2);
    addStarAt(w.x+(Math.random()-0.5)*40,w.y+(Math.random()-0.5)*40);
  }

  function onStarPointerDown(e: React.PointerEvent, n: ConstellationNode) {
    e.stopPropagation(); if (e.button!==0) return;
    if (linkMode) { if (!linkFrom) setLinkFrom(n.id); else if (linkFrom!==n.id) { onAddLink(linkFrom,n.id); setLinkFrom(null); setLinkMode(false); } return; }
    gesture.current={type:'dragnode',id:n.id,nodeX:n.x,nodeY:n.y,startX:e.clientX,startY:e.clientY,moved:false};
  }
  function onStarDoubleClick(e: React.MouseEvent, n: ConstellationNode) { e.stopPropagation(); onOpenNote(n.id); }
  function onHandlePointerDown(e: React.PointerEvent, n: ConstellationNode) {
    e.stopPropagation(); const w=toWorld(e.clientX,e.clientY); setTemp({ fromId:n.id,x:w.x,y:w.y }); gesture.current={type:'connect',id:n.id,startX:e.clientX,startY:e.clientY,moved:false};
  }

  function commitRename() { if (renaming) { onRenameNode(renaming,renameVal.trim()||'Sans nom'); setRenaming(null); } }
  useEffect(() => { if (renaming&&renameInputRef.current) { renameInputRef.current.focus(); renameInputRef.current.select(); } }, [renaming]);

  useEffect(() => {
    const onKey=(e: KeyboardEvent)=>{
      if (renaming) return;
      const tag=(e.target as HTMLElement).tagName?.toLowerCase();
      if (tag==='input'||tag==='textarea'||(e.target as HTMLElement).isContentEditable) return;
      if (e.key==='Escape') { setLinkMode(false); setLinkFrom(null); setSel(null); setTemp(null); }
      else if ((e.key==='Delete'||e.key==='Backspace')&&sel) { if (sel.type==='node') onDeleteNode(sel.id); else onDeleteLink(sel.id); setSel(null); }
      else if (e.key==='l'||e.key==='L') { setLinkMode((v)=>!v); setLinkFrom(null); }
    };
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  }, [sel,renaming]);

  function screenOf(n: ConstellationNode) { const p=nodePos(n); return { x:view.x+p.x*view.scale,y:view.y+p.y*view.scale }; }
  function zoomBy(f: number) { const rect=stageRef.current!.getBoundingClientRect(); const cx=rect.width/2,cy=rect.height/2; const v=viewRef.current; const ns=clamp(v.scale*f,0.25,3); const wx=(cx-v.x)/v.scale,wy=(cy-v.y)/v.scale; setView({ x:cx-wx*ns,y:cy-wy*ns,scale:ns }); }

  const counts={todo:0,doing:0,done:0};
  tree.nodes.forEach((n)=>counts[n.state]++);
  const selNode=sel?.type==='node'?nodesById[sel.id]:null;

  return (
    <div className="constellation">
      {/* topbar */}
      <div className="topbar">
        <button className="btn ghost icon-only" title="Toutes les constellations" onClick={onHome}><IHome size={16}/></button>
        <div className="tree-title">
          <input className="name" defaultValue={tree.name} key={tree.id}
            onBlur={(e)=>onRenameTree(e.target.value.trim()||'Sans titre')}
            onKeyDown={(e)=>{ if (e.key==='Enter') e.currentTarget.blur(); }}/>
        </div>
        <div className="spacer"/>
        <div className="chip"><span className="dot done"/>{counts.done} maîtrisée{counts.done!==1?'s':''}</div>
        <div className="chip"><span className="dot doing"/>{counts.doing} en cours</div>
        <div className="chip"><span className="dot todo"/>{counts.todo} à commencer</div>
      </div>

      {/* stage */}
      <div ref={stageRef} className={`canvas-stage${panning?' panning':''}${linkMode?' linking':''}`}
        onPointerDown={onStagePointerDown} onDoubleClick={onStageDoubleClick}>
        <div className="world" style={{ transform:`translate(${view.x}px,${view.y}px) scale(${view.scale})` }}>
          {/* links svg */}
          <svg className="links-svg" style={{ overflow:'visible' }} width={1} height={1}>
            {tree.links.map((l) => {
              const a=nodesById[l.from],b=nodesById[l.to]; if(!a||!b) return null;
              const pa=nodePos(a),pb=nodePos(b);
              const warm=a.state==='done'&&b.state==='done';
              const selected=sel?.type==='link'&&sel.id===l.id;
              return (
                <g key={l.id} className={'link-grp'+(selected?' link-sel':'')}>
                  <line className={`link-glow${warm?' warm':''}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}/>
                  <line className={`link-line${warm?' warm':''}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}/>
                  <line className="link-hit" x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} onPointerDown={(e)=>{ e.stopPropagation(); setSel({ type:'link',id:l.id }); }}/>
                </g>
              );
            })}
            {temp&&(()=>{ const a=nodesById[temp.fromId]; if(!a) return null; const pa=nodePos(a); return <line className="temp-line" x1={pa.x} y1={pa.y} x2={temp.x} y2={temp.y}/>; })()}
          </svg>

          {/* stars */}
          {tree.nodes.map((n) => {
            const p=nodePos(n);
            const isSel=sel?.type==='node'&&sel.id===n.id;
            const isLinkSrc=linkFrom===n.id;
            const dragging=live?.id===n.id;
            const tw=(3+(parseInt(n.id.replace(/\D/g,'').slice(-2)||'0',10)%18)/6).toFixed(2);
            const dl=((parseInt(n.id.replace(/\D/g,'').slice(-3)||'0',10)%40)/10).toFixed(2);
            return (
              <motion.div key={n.id}
                className={`star ${n.state}${isSel?' selected':''}${dragging?' dragging':''}${linkMode?' link-target':''}${isLinkSrc?' selected':''}`}
                data-node-id={n.id}
                style={{ left:p.x, top:p.y, '--tw':tw+'s', '--dl':dl+'s' } as CSSProperties}
                onPointerDown={(e)=>onStarPointerDown(e,n)}
                onDoubleClick={(e)=>onStarDoubleClick(e,n)}
                layout={!dragging}
                transition={{ type:'spring',stiffness:300,damping:30 }}>
                <span className="ring"/>
                <span className="star-core"/>
                {n.name && <span className="star-label">{n.name}</span>}
                {isSel&&!linkMode&&(
                  <button className="link-handle" title="Glisser pour relier" onPointerDown={(e)=>onHandlePointerDown(e,n)}>+</button>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* star menu */}
      <AnimatePresence>
        {selNode&&!renaming&&!live&&(()=>{
          const s=screenOf(selNode);
          return (
            <motion.div className="star-menu" style={{ left:s.x,top:s.y-4 }}
              initial={{ opacity:0,y:6,scale:0.94 }} animate={{ opacity:1,y:0,scale:1 }} exit={{ opacity:0,y:4,scale:0.94 }}
              transition={{ duration:0.18 }} onPointerDown={(e)=>e.stopPropagation()}>
              <div className="sm-state">
                {STATES.map((st)=>(
                  <button key={st} className={`s${selNode.state===st?' active':''}`} title={STATE_LABEL[st]} onClick={()=>onSetState(selNode.id,st)}>
                    <span className={`dot ${st}`}/>
                  </button>
                ))}
              </div>
              <span className="sm-sep"/>
              <button className="sm-btn" onClick={()=>{ setRenameVal(selNode.name); setRenaming(selNode.id); }}><IEdit size={14}/></button>
              <button className="sm-btn" title="Relier" onClick={()=>{ setLinkMode(true); setLinkFrom(selNode.id); }}><ILink size={14}/></button>
              <button className="sm-btn" onClick={()=>onOpenNote(selNode.id)}><INote size={14}/>Notes</button>
              <span className="sm-sep"/>
              <button className="sm-btn danger" onClick={()=>{ onDeleteNode(selNode.id); setSel(null); }}><ITrash size={14}/></button>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* rename inline */}
      {renaming&&(()=>{ const n=nodesById[renaming]; if(!n) return null; const s=screenOf(n); return (
        <div className="star-rename" style={{ left:s.x,top:s.y }} onPointerDown={(e)=>e.stopPropagation()}>
          <input ref={renameInputRef} value={renameVal} placeholder="Nom de la compétence"
            onChange={(e)=>setRenameVal(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e)=>{ if (e.key==='Enter') commitRename(); if (e.key==='Escape') setRenaming(null); }}/>
        </div>
      ); })()}

      {/* link hint */}
      <AnimatePresence>
        {linkMode&&(
          <motion.div className="link-hint" initial={{ opacity:0,y:-8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-8 }}>
            {linkFrom?'Cliquez la compétence à relier · Échap pour annuler':'Cliquez une compétence, puis une autre · Échap pour annuler'}
          </motion.div>
        )}
      </AnimatePresence>

      {/* empty */}
      {!tree.nodes.length&&(
        <div className="empty-hint"><div className="inner">
          <div className="big">Un ciel encore vierge</div>
          <div style={{ fontSize:14,letterSpacing:'.03em' }}>Double-cliquez n'importe où — ou « Ajouter une compétence »</div>
        </div></div>
      )}

      {/* dock */}
      <div className="dock" onPointerDown={(e)=>e.stopPropagation()}>
        <button className="d-btn primary" onClick={addStarCenter}><IPlus size={16}/>Ajouter une compétence</button>
        <button className={`d-btn${linkMode?' active':''}`} onClick={()=>{ setLinkMode((v)=>!v); setLinkFrom(null); }}><ILink size={16}/>Relier</button>
        <span className="d-sep"/>
        <button className="d-btn" onClick={()=>zoomBy(1/1.25)}><IMinus size={16}/></button>
        <span className="zoom-val">{Math.round(view.scale*100)}%</span>
        <button className="d-btn" onClick={()=>zoomBy(1.25)}><IPlus size={16}/></button>
        <button className="d-btn" title="Recentrer" onClick={fitView}><IRecenter size={16}/></button>
      </div>
    </div>
  );
}
