import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { IBack, IHand, IText, IPen, IEraser, IUndo, IClear } from './Icons';
import { uid } from '../lib/uid';
import type { Tree, ConstellationNode, NoteData, NoteStroke, NoteText } from '../types';

const PEN_COLORS = ['#20242e', '#2a6fdb', '#c0392b', '#1f8a5b', '#8a5cc0'];

function clampN(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }

function strokePath(pts: { x: number; y: number }[]): string {
  if (!pts.length) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y} L ${pts[0].x + 0.1} ${pts[0].y + 0.1}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1], p1 = pts[i];
    const mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2;
    d += ` Q ${p0.x} ${p0.y} ${mx} ${my}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function escapeHtml(s: string) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}

interface Props {
  tree: Tree;
  node: ConstellationNode;
  onBack: () => void;
  onSave: (nodeId: string, data: NoteData) => void;
}

export default function NotesPage({ tree, node, onBack, onSave }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const viewRef  = useRef({ x: 0, y: 0, scale: 1 });
  const [view, _setView] = useState({ x: 0, y: 0, scale: 1 });
  const setView = (v: typeof view | ((p: typeof view) => typeof view)) => {
    const nv = typeof v === 'function' ? v(viewRef.current) : v;
    viewRef.current = nv; _setView(nv);
  };

  const initial = (tree.notes && tree.notes[node.id]) || { texts: [], strokes: [] };
  const [texts,   setTexts]   = useState<NoteText[]>(initial.texts   || []);
  const [strokes, setStrokes] = useState<NoteStroke[]>(initial.strokes || []);
  const [tool,  setTool]  = useState<'pan' | 'text' | 'pen' | 'eraser'>('pan');
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [panning, setPanning] = useState(false);

  const gesture    = useRef<any>(null);
  const drawing    = useRef<NoteStroke | null>(null);
  const undoStack  = useRef<{ texts: NoteText[]; strokes: NoteStroke[] }[]>([]);
  const saveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fitted     = useRef(false);

  // mirror refs for async persist
  const _texts   = useRef(texts);   useEffect(() => { _texts.current   = texts;   }, [texts]);
  const _strokes = useRef(strokes); useEffect(() => { _strokes.current = strokes; }, [strokes]);

  /* centre la vue au montage */
  useEffect(() => {
    if (fitted.current) return; fitted.current = true;
    const rect = stageRef.current!.getBoundingClientRect();
    let cx = 2000, cy = 1500;
    const all = [...(initial.texts || []), ...(initial.strokes || []).flatMap((s) => s.points || [])];
    if (all.length) {
      let mnx=Infinity,mny=Infinity,mxx=-Infinity,mxy=-Infinity;
      all.forEach((p: any)=>{ mnx=Math.min(mnx,p.x);mny=Math.min(mny,p.y);mxx=Math.max(mxx,p.x);mxy=Math.max(mxy,p.y); });
      cx=(mnx+mxx)/2; cy=(mny+mxy)/2;
    }
    setView({ x: rect.width/2 - cx, y: rect.height/2 - cy, scale: 1 });
  }, []);

  /* zoom molette */
  useEffect(() => {
    const stage = stageRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = stage.getBoundingClientRect();
      const cx=e.clientX-rect.left, cy=e.clientY-rect.top;
      const v=viewRef.current;
      const ns=clampN(v.scale*Math.exp(-e.deltaY*0.0012),0.3,4);
      const wx=(cx-v.x)/v.scale, wy=(cy-v.y)/v.scale;
      setView({ x:cx-wx*ns, y:cy-wy*ns, scale:ns });
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, []);

  /* persistance */
  function persist(t: NoteText[], s: NoteStroke[]) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onSave(node.id, { texts: t, strokes: s }), 250);
  }
  function pushUndo() {
    undoStack.current.push({ texts: JSON.parse(JSON.stringify(_texts.current)), strokes: JSON.parse(JSON.stringify(_strokes.current)) });
    if (undoStack.current.length > 40) undoStack.current.shift();
  }
  function undo() {
    const prev = undoStack.current.pop(); if (!prev) return;
    setTexts(prev.texts); setStrokes(prev.strokes); persist(prev.texts, prev.strokes);
  }

  function toWorld(clientX: number, clientY: number) {
    const rect = stageRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX-rect.left-v.x)/v.scale, y: (clientY-rect.top-v.y)/v.scale };
  }

  function eraseAt(clientX: number, clientY: number) {
    const w = toWorld(clientX, clientY);
    const R = 16 / viewRef.current.scale;
    let changed = false;
    const ns = _strokes.current.filter((s) => {
      const hit = (s.points||[]).some((p)=>Math.hypot(p.x-w.x,p.y-w.y)<R+(s.width||2));
      if (hit) changed = true;
      return !hit;
    });
    if (changed) setStrokes(ns);
  }

  /* gestes globaux */
  const moveRef = useRef<(e: PointerEvent) => void>(() => {});
  const upRef   = useRef<(e: PointerEvent) => void>(() => {});

  function onMove(e: PointerEvent) {
    const g = gesture.current; if (!g) return;
    const dx=e.clientX-g.startX, dy=e.clientY-g.startY;
    if (!g.moved&&Math.hypot(dx,dy)>4) g.moved=true;
    if (g.type==='pan') setView({ x:g.vx+dx, y:g.vy+dy, scale:viewRef.current.scale });
    else if (g.type==='draw') {
      const cur=drawing.current; if(!cur) return;
      const w=toWorld(e.clientX,e.clientY);
      cur.points.push({ x:Math.round(w.x), y:Math.round(w.y) });
      const snap = { ...cur, points:[...cur.points] };
      setStrokes((s)=>[...s.slice(0,-1),snap]);
    } else if (g.type==='movetext') {
      const s=viewRef.current.scale;
      const nx=g.tx+dx/s, ny=g.ty+dy/s;
      setTexts((arr)=>arr.map((t)=>t.id===g.id?{...t,x:Math.round(nx),y:Math.round(ny)}:t));
    } else if (g.type==='erase') eraseAt(e.clientX,e.clientY);
  }
  function onUp(_e: PointerEvent) {
    const g=gesture.current; if(!g) return; gesture.current=null;
    if (g.type==='pan') setPanning(false);
    else if (g.type==='draw') { drawing.current=null; persist(_texts.current,_strokes.current); }
    else if (g.type==='movetext') { if (g.moved) persist(_texts.current,_strokes.current); }
    else if (g.type==='erase') persist(_texts.current,_strokes.current);
  }
  moveRef.current=onMove; upRef.current=onUp;
  useEffect(() => {
    const m=(e:PointerEvent)=>moveRef.current(e);
    const u=(e:PointerEvent)=>upRef.current(e);
    window.addEventListener('pointermove',m);
    window.addEventListener('pointerup',u);
    return ()=>{ window.removeEventListener('pointermove',m); window.removeEventListener('pointerup',u); };
  }, []);

  function startG(type: string, e: React.PointerEvent, extra?: object) {
    gesture.current = { type, startX:e.clientX, startY:e.clientY, moved:false, ...extra };
  }

  function onStageDown(e: React.PointerEvent) {
    if (e.button!==0) return;
    const onText=(e.target as HTMLElement).closest('.note-text');
    if (onText) return;
    if (tool==='pen') {
      pushUndo();
      const w=toWorld(e.clientX,e.clientY);
      drawing.current = { id:uid('st'), color, width:2.2, points:[{ x:Math.round(w.x), y:Math.round(w.y) }] };
      setStrokes((s)=>[...s,{ ...drawing.current! }]);
      startG('draw',e);
    } else if (tool==='text') {
      pushUndo();
      const w=toWorld(e.clientX,e.clientY);
      const id=uid('tx');
      const nt: NoteText[] = [..._texts.current, { id, x:Math.round(w.x), y:Math.round(w.y), content:'', color:'#20242e' }];
      setTexts(nt); persist(nt,_strokes.current);
      setTimeout(()=>{ const el=document.getElementById('txt_'+id); if(el) el.focus(); },20);
    } else if (tool==='eraser') {
      pushUndo(); startG('erase',e); eraseAt(e.clientX,e.clientY);
    } else {
      setPanning(true); startG('pan',e,{ vx:viewRef.current.x, vy:viewRef.current.y });
    }
  }

  function onTextDown(e: React.PointerEvent, t: NoteText) {
    if (tool==='eraser') {
      e.stopPropagation(); pushUndo();
      const nt=_texts.current.filter((x)=>x.id!==t.id); setTexts(nt); persist(nt,_strokes.current);
      return;
    }
    if (tool==='pan'||tool==='text') startG('movetext',e,{ id:t.id, tx:t.x, ty:t.y });
  }
  function onTextInput(e: React.FormEvent, t: NoteText) {
    const content=(e.target as HTMLElement).innerText;
    const nt=_texts.current.map((x)=>x.id===t.id?{...x,content}:x);
    _texts.current=nt; persist(nt,_strokes.current);
  }
  function onTextBlur(e: React.FocusEvent, t: NoteText) {
    const content=(e.target as HTMLElement).innerText.trim();
    const nt=content?_texts.current.map((x)=>x.id===t.id?{...x,content:(e.target as HTMLElement).innerText}:x):_texts.current.filter((x)=>x.id!==t.id);
    setTexts(nt); persist(nt,_strokes.current);
  }
  function clearAll() {
    if (!texts.length&&!strokes.length) return;
    pushUndo(); setTexts([]); setStrokes([]); persist([],[]);
  }

  /* clavier */
  useEffect(() => {
    const onKey=(e: KeyboardEvent)=>{
      const ce=(e.target as HTMLElement).isContentEditable||['input','textarea'].includes((e.target as HTMLElement).tagName?.toLowerCase());
      if (ce) return;
      if (e.key==='Escape') onBack();
      else if ((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z') { e.preventDefault(); undo(); }
      else if (e.key==='v'||e.key==='1') setTool('pan');
      else if (e.key==='t'||e.key==='2') setTool('text');
      else if (e.key==='p'||e.key==='3') setTool('pen');
      else if (e.key==='e'||e.key==='4') setTool('eraser');
    };
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  }, [texts,strokes]);

  const cursor = tool==='pen'?'crosshair':tool==='eraser'?'cell':tool==='text'?'text':(panning?'grabbing':'grab');
  const stateLabel = { todo:'À commencer', doing:'En cours', done:'Maîtrisée' };

  return (
    <div className="notes">
      {/* header */}
      <div className="note-head">
        <motion.button className="icon-btn" title="Retour" onClick={onBack} whileTap={{ scale:0.93 }}>
          <IBack size={16}/>
        </motion.button>
        <div className="title">
          <span className={`star ${node.state}`} style={{ position:'static' }}>
            <span className="star-core" style={{ position:'static', transform:'none' }}/>
          </span>
          <h2>{node.name||'Sans nom'}</h2>
          <span className="chip" style={{ marginLeft:6 }}>
            <span className={`dot ${node.state}`}/>
            {stateLabel[node.state]}
          </span>
        </div>
      </div>

      {/* tool rail */}
      <div className="tool-rail">
        {([['pan','Déplacer (V)',IHand],['text','Texte (T)',IText],['pen','Dessiner (P)',IPen],['eraser','Gomme (E)',IEraser]] as const).map(([t,title,Ic])=>(
          <motion.button key={t} className={`t-btn${tool===t?' active':''}`} title={title} onClick={()=>setTool(t)} whileTap={{ scale:0.88 }}>
            <Ic size={18}/>
          </motion.button>
        ))}
        <div className="t-sep"/>
        <div style={{ display:'flex',flexDirection:'column',gap:6,alignItems:'center',padding:'2px 0' }}>
          {PEN_COLORS.map((c)=>(
            <button key={c} className={`swatch${color===c?' active':''}`} style={{ background:c }}
              onClick={()=>{ setColor(c); if(tool!=='pen') setTool('pen'); }}/>
          ))}
        </div>
        <div className="t-sep"/>
        <motion.button className="t-btn" title="Annuler (⌘Z)" onClick={undo} whileTap={{ scale:0.88 }}><IUndo size={18}/></motion.button>
        <motion.button className="t-btn" title="Tout effacer" onClick={clearAll} whileTap={{ scale:0.88 }}><IClear size={18}/></motion.button>
      </div>

      {/* canvas */}
      <div ref={stageRef} className="notes-stage" style={{ cursor }} onPointerDown={onStageDown}>
        <div className="notes-world" style={{ transform:`translate(${view.x}px,${view.y}px) scale(${view.scale})` }}>
          <svg className="draw-svg">
            {strokes.map((s)=>(
              <path key={s.id} d={strokePath(s.points||[])} stroke={s.color} strokeWidth={s.width||2.2}
                fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            ))}
          </svg>
          {texts.map((t)=>(
            <div key={t.id} id={'txt_'+t.id} className="note-text"
              contentEditable suppressContentEditableWarning
              data-ph="Écrire…"
              style={{ left:t.x, top:t.y, color:t.color }}
              onPointerDown={(e)=>onTextDown(e,t)}
              onInput={(e)=>onTextInput(e,t)}
              onBlur={(e)=>onTextBlur(e,t)}
              dangerouslySetInnerHTML={{ __html:escapeHtml(t.content) }}
            />
          ))}
        </div>
      </div>

      {/* hint */}
      <div className="toast" style={{ left:'auto', right:22 }}>
        Molette pour zoomer · glisser pour se déplacer
      </div>
    </div>
  );
}
